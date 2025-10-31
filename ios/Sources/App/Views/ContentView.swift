import SwiftUI
import UIKit

struct ContentView: View {
  @EnvironmentObject private var appState: AppState
  @State private var showingSignIn = false
  @State private var identifier: String = ""
  @State private var password: String = ""

  private var localeCode: String {
    if #available(iOS 16, *) {
      return Locale.current.language.languageCode?.identifier.lowercased() ?? "en"
    }
    if let preferred = Locale.preferredLanguages.first {
      return preferred.split(separator: "-").first?.lowercased() ?? "en"
    }
    return Locale.current.identifier.split(separator: "_").first?.lowercased() ?? "en"
  }

  var body: some View {
    NavigationStack {
      BorrowerExperienceView(
        localeCode: localeCode,
        onSignIn: { showingSignIn = true },
        onSignOut: { Task { await appState.signOut() } }
      )
      .navigationBarHidden(true)
    }
    .task {
      await appState.bootstrapIfNeeded()
    }
    .task(id: appState.session?.user.id) {
      guard appState.session != nil else { return }
      await appState.loadChat(force: true)
      await appState.loadRecommendations(force: true)
      await appState.loadDealCases(force: true)
    }
    .sheet(isPresented: $showingSignIn) {
      SignInSheet(identifier: $identifier, password: $password, isPresenting: $showingSignIn)
        .environmentObject(appState)
    }
  }
}

// MARK: - Borrower Experience

struct BorrowerExperienceView: View {
  @EnvironmentObject private var appState: AppState

  private let onSignIn: () -> Void
  private let onSignOut: () -> Void
  @State private var localeCode: String
  @State private var messageDraft: String = ""
  @State private var showingDeal: DealCase?

  init(localeCode: String, onSignIn: @escaping () -> Void, onSignOut: @escaping () -> Void) {
    self.onSignIn = onSignIn
    self.onSignOut = onSignOut
    _localeCode = State(initialValue: localeCode)
  }

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private var chatMessages: [ChatMessage] {
    let existing = appState.chatConversation?.messages ?? []
    if existing.isEmpty {
      return [
        ChatMessage(
          id: "intro-ai",
          author: .ai,
          content: isChinese
            ? "您好，我是金桥 AI 信贷顾问，我们会一步步梳理您的贷款需求。"
            : "Welcome to Golden Bridge Loan. I'm your AI lending guide - let's map out the perfect financing game plan for you."
        ),
        ChatMessage(
          id: "intro-question",
          author: .ai,
          content: isChinese
            ? "您计划贷款购买的房产在哪里？请告诉我城市、州或邮编。"
            : "Where is the property you plan to finance? Let me know the city, state, or zip code."
        )
      ]
    }
    return existing
  }

  private var recommendationErrorMessage: String? {
    appState.recommendationError?.localizedDescription
  }

  private var dealErrorMessage: String? {
    appState.dealCasesError?.localizedDescription
  }

  var body: some View {
    ZStack {
      Color(red: 4 / 255, green: 8 / 255, blue: 26 / 255)
        .ignoresSafeArea()

      VStack(spacing: 0) {
        MobileHeaderView(
          isChinese: isChinese,
          session: appState.session,
          onToggleLanguage: toggleLanguage,
          onInsights: {},
          onSignIn: onSignIn,
          onSignOut: onSignOut
        )
        .padding(.horizontal, 16)
        .padding(.top, 14)
        .padding(.bottom, 8)

        ChatMessagesView(
          messages: chatMessages,
          isChinese: isChinese,
          isLoading: appState.isChatLoading,
          errorMessage: appState.chatError?.localizedDescription,
          onRetry: { Task { await appState.loadChat(force: true) } }
        )
        .padding(.horizontal, 16)
        .padding(.bottom, 18)
        .layoutPriority(1)

        TopMatchesView(
          isChinese: isChinese,
          recommendations: Array(appState.recommendations.prefix(3)),
          isLoading: appState.recommendationsLoading,
          errorMessage: recommendationErrorMessage,
          onRefresh: { Task { await appState.loadRecommendations(force: true) } }
        )
        .padding(.horizontal, 16)

        DealsCarouselView(
          isChinese: isChinese,
          deals: appState.dealCases,
          isLoading: appState.dealCasesLoading,
          errorMessage: dealErrorMessage,
          onSelect: { showingDeal = $0 }
        )
        .padding(.top, 18)
        .padding(.horizontal, 16)

        ChatComposerView(
          isChinese: isChinese,
          messageDraft: $messageDraft,
          isSending: appState.isSendingMessage,
          onSend: sendCurrentDraft,
          onReset: { Task { await appState.resetChat() } }
        )
        .padding(.horizontal, 16)
        .padding(.top, 24)
        .padding(.bottom, 24)
      }
    }
    .sheet(item: $showingDeal) { deal in
      DealDetailView(deal: deal, localeCode: localeCode) {
        showingDeal = nil
      }
    }
    .onChange(of: localeCode) { _ in
      Task { await appState.resetChat() }
    }
  }

  private func toggleLanguage() {
    localeCode = localeCode.hasPrefix("zh") ? "en" : "zh"
  }

  private func sendCurrentDraft() {
    let trimmed = messageDraft.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty else { return }
    messageDraft = ""
    Task {
      await appState.sendChatMessage(trimmed)
    }
  }
}

private struct MobileHeaderView: View {
  let isChinese: Bool
  let session: UserSession?
  let onToggleLanguage: () -> Void
  let onInsights: () -> Void
  let onSignIn: () -> Void
  let onSignOut: () -> Void

  var body: some View {
    HStack {
      HStack(spacing: 8) {
        Text("GOLDEN BRIDGE")
          .font(.system(size: 11, weight: .semibold))
          .tracking(1.2)
          .textCase(.uppercase)
          .padding(.horizontal, 12)
          .padding(.vertical, 6)
          .background(Color(red: 44 / 255, green: 64 / 255, blue: 142 / 255).opacity(0.35))
          .foregroundColor(Color(red: 231 / 255, green: 208 / 255, blue: 109 / 255))
          .clipShape(Capsule())

        Button(action: onToggleLanguage) {
          Text(isChinese ? "EN" : "中")
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .buttonStyle(CapsuleStrokeButton())
      }

      Spacer()

      HStack(spacing: 8) {
        Button(action: onInsights) {
          Text(isChinese ? "智能摘要" : "Insights")
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .buttonStyle(CapsuleStrokeButton())

        if session != nil {
          Button(action: onSignOut) {
            Text(isChinese ? "退出" : "Sign out")
              .font(.system(size: 12, weight: .medium))
              .padding(.horizontal, 12)
              .padding(.vertical, 6)
          }
          .buttonStyle(CapsuleStrokeButton(borderColor: Color(red: 244 / 255, green: 114 / 255, blue: 182 / 255)))
        } else {
          Button(action: onSignIn) {
            Text(isChinese ? "登录" : "Sign in")
              .font(.system(size: 12, weight: .medium))
              .padding(.horizontal, 12)
              .padding(.vertical, 6)
          }
          .buttonStyle(CapsuleStrokeButton())
        }
      }
    }
  }
}

private struct ChatMessagesView: View {
  let messages: [ChatMessage]
  let isChinese: Bool
  let isLoading: Bool
  let errorMessage: String?
  let onRetry: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      ScrollViewReader { proxy in
        ScrollView(.vertical, showsIndicators: false) {
          LazyVStack(alignment: .leading, spacing: 16) {
            ForEach(messages) { message in
              ChatBubbleView(message: message, isChinese: isChinese)
                .id(message.id)
            }
          }
          .padding(.vertical, 8)
        }
        .onChange(of: messages.last?.id) { last in
          guard let last else { return }
          DispatchQueue.main.async {
            withAnimation { proxy.scrollTo(last, anchor: .bottom) }
          }
        }
      }

      if let errorMessage {
        HStack(spacing: 8) {
          Image(systemName: "exclamationmark.triangle.fill")
            .foregroundColor(.orange)
          Text(errorMessage)
            .font(.system(size: 12))
            .foregroundColor(.orange)
          Spacer()
          Button(isChinese ? "重试" : "Retry", action: onRetry)
            .font(.system(size: 12, weight: .semibold))
            .foregroundColor(.orange)
        }
        .padding(12)
        .background(Color.orange.opacity(0.15))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
      }

      if isLoading {
        HStack(spacing: 8) {
          ProgressView()
            .progressViewStyle(.circular)
            .tint(.white)
          Text(isChinese ? "正在分析您的资料…" : "Analyzing your profile...")
            .font(.system(size: 12))
            .foregroundColor(Color.white.opacity(0.7))
        }
        .padding(12)
        .background(Color.white.opacity(0.06))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
      }
    }
    .padding(18)
    .background(Color.white.opacity(0.05))
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct ChatBubbleView: View {
  let message: ChatMessage
  let isChinese: Bool

  private var isUser: Bool { message.author == .user }

  var body: some View {
    HStack {
      if isUser { Spacer(minLength: 32) }
      VStack(alignment: .leading, spacing: 6) {
        if !isUser {
          Text(isChinese ? "GOLDEN BRIDGE AI" : "GOLDEN BRIDGE AI")
            .font(.system(size: 10, weight: .semibold))
            .tracking(1.2)
            .foregroundColor(Color.white.opacity(0.5))
        }
        Text(message.content)
          .font(.system(size: 14))
          .foregroundColor(isUser ? Color(red: 10 / 255, green: 26 / 255, blue: 42 / 255) : .white)
          .multilineTextAlignment(.leading)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .background(
        LinearGradient(
          colors: isUser
            ? [Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255), Color(red: 34 / 255, green: 204 / 255, blue: 238 / 255)]
            : [Color.white.opacity(0.06), Color.white.opacity(0.04)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      )
      .clipShape(RoundedRectangle(cornerRadius: 22, style: .continuous))
      if !isUser { Spacer(minLength: 32) }
    }
  }
}

private struct TopMatchesView: View {
  let isChinese: Bool
  let recommendations: [Recommendation]
  let isLoading: Bool
  let errorMessage: String?
  let onRefresh: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      HStack {
        Text(isChinese ? "精选贷款方" : "Top matches")
          .font(.system(size: 13, weight: .semibold))
          .foregroundColor(Color.white.opacity(0.8))
          .tracking(1.1)
          .textCase(.uppercase)
        Spacer()
        Button(action: onRefresh) {
          Text(isChinese ? "刷新" : "Refresh")
            .font(.system(size: 12, weight: .medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
        }
        .buttonStyle(CapsuleStrokeButton())
      }

      if isLoading {
        ProgressView()
          .progressViewStyle(.circular)
          .tint(.white)
      } else if let errorMessage {
        Text(errorMessage)
          .font(.system(size: 12))
          .foregroundColor(Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255))
      } else if recommendations.isEmpty {
        Text(isChinese ? "暂无匹配，请补充更多需求信息。" : "No matches yet—share more details to unlock recommendations.")
          .font(.system(size: 12))
          .foregroundColor(Color.white.opacity(0.6))
      } else {
        VStack(spacing: 12) {
          ForEach(recommendations) { recommendation in
            TopMatchCard(recommendation: recommendation, isChinese: isChinese)
          }
        }
      }
    }
    .padding(18)
    .background(Color.white.opacity(0.05))
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct TopMatchCard: View {
  let recommendation: Recommendation
  let isChinese: Bool

  var body: some View {
    HStack(alignment: .top, spacing: 12) {
      VStack(alignment: .leading, spacing: 6) {
        Text(recommendation.company ?? recommendation.lenderName ?? "Golden Bridge Broker")
          .font(.system(size: 15, weight: .semibold))
          .foregroundColor(.white)
        if let headline = recommendation.headline, !headline.isEmpty {
          Text(isChinese ? translateHeadline(headline) : headline)
            .font(.system(size: 12))
            .foregroundColor(Color.white.opacity(0.7))
        }
      }
      Spacer()
      if let badge = badgeTitle {
        Text(badge)
          .font(.system(size: 11, weight: .semibold))
          .foregroundColor(Color(red: 231 / 255, green: 208 / 255, blue: 109 / 255))
          .padding(.horizontal, 12)
          .padding(.vertical, 6)
          .background(Color(red: 79 / 255, green: 74 / 255, blue: 50 / 255))
          .clipShape(Capsule())
      }
    }
    .padding(16)
    .background(Color.white.opacity(0.05))
    .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
  }

  private var badgeTitle: String? {
    switch recommendation.category {
    case .lowestRate: return isChinese ? "低利率" : "Low rate"
    case .highestLtv: return isChinese ? "高成数" : "High LTV"
    case .fastestClosing: return isChinese ? "放款快" : "Fast close"
    case .additional: return isChinese ? "备选" : "Alt match"
    }
  }

  private func translateHeadline(_ text: String) -> String {
    switch text {
    case "Tech professional and startup-friendly jumbo lending across Northern California":
      return "专注北加州科技及创业客户的大额贷款团队"
    case "SoCal purchase and refinance specialist with investor solutions":
      return "南加州购房与再融资专家，兼顾投资需求"
    case "Specialist in coastal condos and vacation homes":
      return "擅长海岸公寓与度假房贷项目"
    default:
      return text
    }
  }
}

private struct DealsCarouselView: View {
  let isChinese: Bool
  let deals: [DealCase]
  let isLoading: Bool
  let errorMessage: String?
  let onSelect: (DealCase) -> Void

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: isChinese ? "zh" : "en")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 14) {
      Text(isChinese ? "成交案例" : "Recent closings")
        .font(.system(size: 13, weight: .semibold))
        .foregroundColor(Color.white.opacity(0.8))
        .tracking(1.1)
        .textCase(.uppercase)

      if isLoading {
        ProgressView()
          .progressViewStyle(.circular)
          .tint(.white)
      } else if let errorMessage {
        Text(errorMessage)
          .font(.system(size: 12))
          .foregroundColor(Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255))
      } else if deals.isEmpty {
        Text(isChinese ? "加载中或暂无案例，稍后再来看看。" : "No deal stories yet—check back soon.")
          .font(.system(size: 12))
          .foregroundColor(Color.white.opacity(0.6))
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 14) {
            ForEach(deals) { deal in
              Button {
                onSelect(deal)
              } label: {
                VStack(alignment: .leading, spacing: 10) {
                  AsyncImage(url: deal.heroImage.url) { phase in
                    switch phase {
                    case let .success(image):
                      image
                        .resizable()
                        .scaledToFill()
                    case .empty:
                      ZStack {
                        Color.white.opacity(0.08)
                        ProgressView()
                          .progressViewStyle(.circular)
                          .tint(.white)
                      }
                    case .failure:
                      ZStack {
                        Color.white.opacity(0.08)
                        Image(systemName: "photo")
                          .foregroundColor(.white.opacity(0.4))
                      }
                    @unknown default:
                      Color.white.opacity(0.08)
                    }
                  }
                  .frame(width: 220, height: 130)
                  .clipped()
                  .cornerRadius(18)

                  Text("\(deal.city), \(deal.state)")
                    .font(.system(size: 14, weight: .semibold))
                    .foregroundColor(.white)

                  if !localized(deal.highlight).isEmpty {
                    Text(localized(deal.highlight))
                      .font(.system(size: 12))
                      .foregroundColor(Color.white.opacity(0.7))
                      .lineLimit(2)
                  }
                }
                .padding(14)
                .background(Color.white.opacity(0.05))
                .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
                .frame(width: 220, alignment: .leading)
              }
            }
          }
          .padding(.vertical, 4)
        }
      }
    }
  }
}

private struct DealDetailView: View {
  let deal: DealCase
  let localeCode: String
  let onClose: () -> Void

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: isChinese ? "zh" : "en")
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 18) {
          AsyncImage(url: deal.heroImage.url) { phase in
            switch phase {
            case let .success(image):
              image
                .resizable()
                .scaledToFill()
            case .empty:
              ZStack {
                Color.gray.opacity(0.2)
                ProgressView()
              }
            case .failure:
              ZStack {
                Color.gray.opacity(0.2)
                Image(systemName: "photo")
                  .foregroundColor(.gray)
              }
            @unknown default:
              Color.gray.opacity(0.2)
            }
          }
          .frame(height: 260)
          .clipped()
          .cornerRadius(22)

          VStack(alignment: .leading, spacing: 12) {
            Text("\(deal.city), \(deal.state)")
              .font(.title2)
              .fontWeight(.bold)

            if !localized(deal.price).isEmpty {
              Text(localized(deal.price))
                .font(.headline)
            }

            if !localized(deal.timeline).isEmpty {
              Text(localized(deal.timeline))
                .foregroundColor(.secondary)
            }

            Divider()

            detailRow(title: isChinese ? "客户画像" : "Borrower profile", value: localized(deal.borrowerType))
            detailRow(title: isChinese ? "贷款方案" : "Loan program", value: localized(deal.product))
            detailRow(title: isChinese ? "成交亮点" : "Result highlight", value: localized(deal.highlight))
          }

          if !deal.gallery.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
              Text(isChinese ? "更多现场" : "Gallery")
                .font(.headline)

              ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 12) {
                  ForEach(deal.gallery) { media in
                    AsyncImage(url: media.url) { phase in
                      switch phase {
                      case let .success(image):
                        image
                          .resizable()
                          .scaledToFill()
                      case .empty:
                        ZStack {
                          Color.gray.opacity(0.2)
                          ProgressView()
                        }
                      case .failure:
                        ZStack {
                          Color.gray.opacity(0.2)
                          Image(systemName: "photo")
                            .foregroundColor(.gray)
                        }
                      @unknown default:
                        Color.gray.opacity(0.2)
                      }
                    }
                    .frame(width: 200, height: 130)
                    .clipped()
                    .cornerRadius(16)
                  }
                }
                .padding(.vertical, 6)
              }
            }
          }
        }
        .padding()
      }
      .navigationTitle(deal.city)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button(isChinese ? "关闭" : "Close", action: onClose)
        }
      }
    }
  }

  private func detailRow(title: String, value: String) -> some View {
    VStack(alignment: .leading, spacing: 4) {
      Text(title)
        .font(.caption)
        .foregroundColor(.secondary)
      Text(value)
        .font(.body)
    }
  }
}

private struct ChatComposerView: View {
  let isChinese: Bool
  @Binding var messageDraft: String
  let isSending: Bool
  let onSend: () -> Void
  let onReset: () -> Void

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      Text(isChinese ? "描述您的融资需求，让 AI 帮您撮合。" : "Describe your financing goal and let the AI orchestrate the next step.")
        .font(.system(size: 12))
        .foregroundColor(Color.white.opacity(0.6))

      TextEditor(text: $messageDraft)
        .frame(minHeight: 80, maxHeight: 140)
        .padding(12)
        .background(Color.white.opacity(0.05))
        .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
        .overlay(
          RoundedRectangle(cornerRadius: 18, style: .continuous)
            .stroke(Color.white.opacity(0.08), lineWidth: 1)
        )
        .foregroundColor(.white)
        .font(.system(size: 15))

      HStack {
        Button(action: onReset) {
          Text(isChinese ? "重置" : "Reset")
            .font(.system(size: 13, weight: .medium))
            .padding(.horizontal, 12)
            .padding(.vertical, 8)
        }
        .buttonStyle(CapsuleStrokeButton())

        Spacer()

        Button {
          onSend()
        } label: {
          if isSending {
            ProgressView()
              .progressViewStyle(.circular)
              .tint(Color(red: 10 / 255, green: 26 / 255, blue: 42 / 255))
              .padding(.vertical, 14)
              .frame(width: 110)
          } else {
            Text(isChinese ? "发送" : "Send")
              .font(.system(size: 15, weight: .semibold))
              .padding(.horizontal, 28)
              .padding(.vertical, 14)
          }
        }
        .buttonStyle(PrimaryCapsuleButton())
        .disabled(messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending)
        .opacity(messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isSending ? 0.7 : 1)
      }
    }
  }
}

private struct CapsuleStrokeButton: ButtonStyle {
  var borderColor: Color = Color.white.opacity(0.15)

  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundColor(Color.white.opacity(configuration.isPressed ? 0.7 : 0.85))
      .background(
        Capsule()
          .stroke(borderColor, lineWidth: 1)
      )
      .background(
        Capsule()
          .fill(Color.white.opacity(configuration.isPressed ? 0.08 : 0.03))
      )
  }
}

private struct PrimaryCapsuleButton: ButtonStyle {
  func makeBody(configuration: Configuration) -> some View {
    configuration.label
      .foregroundColor(Color(red: 10 / 255, green: 26 / 255, blue: 42 / 255))
      .background(
        Capsule()
          .fill(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
      )
      .scaleEffect(configuration.isPressed ? 0.98 : 1)
  }
}
// MARK: - Sign In Sheet

private struct SignInSheet: View {
  @EnvironmentObject private var appState: AppState

  @Binding var identifier: String
  @Binding var password: String
  @Binding var isPresenting: Bool

  @State private var isSubmitting = false

  var body: some View {
    NavigationStack {
      Form {
        Section(header: Text("Email or US phone")) {
          TextField("you@company.com or +1 (555) 555-1234", text: $identifier)
            .textContentType(.username)
            .textInputAutocapitalization(.never)
            .keyboardType(.emailAddress)
        }

        Section(header: Text("Password")) {
          SecureField("Minimum 8 characters", text: $password)
            .textContentType(.password)
        }

        if let error = appState.authenticationError {
          Section {
            Text(error.localizedDescription)
              .foregroundColor(.red)
              .font(.footnote)
          }
        }
      }
      .navigationTitle("Sign in")
      .toolbar {
        ToolbarItem(placement: .cancellationAction) {
          Button("Cancel") { isPresenting = false }
        }
        ToolbarItem(placement: .confirmationAction) {
          Button {
            Task {
              isSubmitting = true
              await appState.signIn(identifier: identifier, password: password)
              isSubmitting = false
              if appState.session != nil {
                isPresenting = false
              }
            }
          } label: {
            if isSubmitting {
              ProgressView()
            } else {
              Text("Continue")
            }
          }
          .disabled(identifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty || isSubmitting)
        }
      }
    }
    .presentationDetents([.medium])
  }
}

// MARK: - Helpers

private extension NumberFormatter {
  static func currency(localeCode: String) -> NumberFormatter {
    let formatter = NumberFormatter()
    formatter.numberStyle = .currency
    formatter.currencyCode = "USD"
    formatter.locale = Locale(identifier: localeCode.hasPrefix("zh") ? "zh_CN" : "en_US")
    formatter.maximumFractionDigits = 0
    return formatter
  }
}

#Preview {
  ContentView()
    .environmentObject(AppState())
}
