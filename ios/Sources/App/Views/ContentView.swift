import SwiftUI

enum DashboardTab: Hashable {
  case chat
  case recommendations
  case deals
}

struct ContentView: View {
  @EnvironmentObject private var appState: AppState
  @State private var identifier: String = ""
  @State private var password: String = ""
  @State private var selectedTab: DashboardTab = .chat

  var body: some View {
    NavigationStack {
      Group {
        if appState.session != nil {
          DashboardView(selectedTab: $selectedTab)
        } else {
          SignInForm(identifier: $identifier, password: $password)
        }
      }
      .navigationTitle("Golden Bridge")
      .toolbar {
        if appState.session != nil {
          ToolbarItem(placement: .navigationBarTrailing) {
            Button("退出登录") {
              Task { await appState.signOut() }
            }
          }
        }
      }
    }
  }
}

private struct SignInForm: View {
  @EnvironmentObject private var appState: AppState
  @Binding var identifier: String
  @Binding var password: String

  var body: some View {
    Form {
      Section(header: Text("账户")) {
        TextField("邮箱或手机号", text: $identifier)
          .keyboardType(.emailAddress)
          .textContentType(.username)
          .textInputAutocapitalization(.never)
        SecureField("密码", text: $password)
          .textContentType(.password)
      }

      if let error = appState.authenticationError {
        Text(error.localizedDescription)
          .foregroundColor(.red)
      }

      Button {
        Task { await appState.signIn(identifier: identifier, password: password) }
      } label: {
        if appState.isAuthenticating {
          ProgressView()
        } else {
          Text("登录")
            .frame(maxWidth: .infinity)
        }
      }
      .disabled(appState.isAuthenticating || identifier.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || password.isEmpty)
    }
  }
}

private struct DashboardView: View {
  @EnvironmentObject private var appState: AppState
  @Binding var selectedTab: DashboardTab

  var body: some View {
    TabView(selection: $selectedTab) {
      ChatView()
        .tabItem {
          Label("对话", systemImage: "ellipsis.bubble")
        }
        .tag(DashboardTab.chat)

      RecommendationsView()
        .tabItem {
          Label("推荐", systemImage: "star.fill")
        }
        .tag(DashboardTab.recommendations)

      DealsView()
        .tabItem {
          Label("案例", systemImage: "building.2.crop.circle")
        }
        .tag(DashboardTab.deals)
    }
    .task(id: appState.session?.user.id) {
      await appState.loadChat(force: true)
      await appState.loadRecommendations(force: true)
      await appState.loadDealCases(force: true)
    }
  }
}

private struct ChatView: View {
  @EnvironmentObject private var appState: AppState
  @State private var messageDraft: String = ""

  var body: some View {
    VStack(spacing: 12) {
      conversationContent
      composer
    }
    .padding(.horizontal)
    .toolbar {
      ToolbarItem(placement: .navigationBarTrailing) {
        if appState.chatConversation != nil {
          Button("重置对话") {
            Task { await appState.resetChat() }
          }
        }
      }
    }
  }

  @ViewBuilder
  private var conversationContent: some View {
    if appState.isChatLoading && appState.chatConversation?.messages.isEmpty ?? true {
      ProgressView("正在加载对话…")
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 32)
    } else if let error = appState.chatError, appState.chatConversation?.messages.isEmpty ?? true {
      VStack(spacing: 12) {
        Text(error.localizedDescription)
          .multilineTextAlignment(.center)
          .foregroundColor(.red)
        Button("重新加载") {
          Task { await appState.loadChat(force: true) }
        }
      }
      .frame(maxWidth: .infinity, alignment: .center)
      .padding(.top, 32)
    } else {
      ScrollViewReader { proxy in
        ScrollView {
          LazyVStack(alignment: .leading, spacing: 12) {
            ForEach(appState.chatConversation?.messages ?? []) { message in
              ChatBubble(message: message)
                .id(message.id)
            }
          }
          .frame(maxWidth: .infinity, alignment: .leading)
          .padding(.vertical, 12)
        }
        .onChange(of: appState.chatConversation?.messages.last?.id) { lastId in
          guard let lastId else { return }
          DispatchQueue.main.async {
            withAnimation {
              proxy.scrollTo(lastId, anchor: .bottom)
            }
          }
        }
      }
    }

    if let error = appState.chatError, !(appState.chatConversation?.messages.isEmpty ?? true) {
      HStack(spacing: 8) {
        Image(systemName: "exclamationmark.triangle.fill")
          .foregroundColor(.orange)
        Text(error.localizedDescription)
          .font(.footnote)
          .foregroundColor(.orange)
        Spacer()
        Button("重试") {
          Task { await appState.loadChat(force: true) }
        }
        .font(.footnote)
      }
      .padding(.horizontal, 12)
      .padding(.vertical, 8)
      .background(Color.orange.opacity(0.1))
      .cornerRadius(10)
    }
  }

  private var composer: some View {
    HStack(alignment: .bottom, spacing: 12) {
      TextField("向智能顾问提问…", text: $messageDraft, axis: .vertical)
        .textFieldStyle(.roundedBorder)
        .textInputAutocapitalization(.sentences)
        .disableAutocorrection(false)

      Button {
        let text = messageDraft
        messageDraft = ""
        Task { await appState.sendChatMessage(text) }
      } label: {
        if appState.isSendingMessage {
          ProgressView()
            .progressViewStyle(.circular)
        } else {
          Image(systemName: "paperplane.fill")
            .font(.system(size: 18, weight: .semibold))
        }
      }
      .disabled(messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || appState.isSendingMessage)
      .buttonStyle(.borderedProminent)
    }
    .padding(.vertical, 12)
  }
}

private struct ChatBubble: View {
  let message: ChatMessage

  private var isCurrentUser: Bool {
    message.author == .user
  }

  var body: some View {
    HStack {
      if isCurrentUser { Spacer() }
      Text(message.content)
        .padding(.horizontal, 14)
        .padding(.vertical, 10)
        .foregroundColor(isCurrentUser ? .white : .primary)
        .background(isCurrentUser ? Color.accentColor : Color(.systemGray6))
        .cornerRadius(16)
        .frame(maxWidth: UIScreen.main.bounds.width * 0.72, alignment: isCurrentUser ? .trailing : .leading)
      if !isCurrentUser { Spacer() }
    }
    .transition(.opacity.combined(with: .move(edge: isCurrentUser ? .trailing : .leading)))
  }
}

private struct RecommendationsView: View {
  @EnvironmentObject private var appState: AppState

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      header
      content
      refreshButton
    }
    .padding()
  }

  private var header: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("推荐经纪人")
        .font(.title3)
        .bold()
      if let name = appState.session?.user.name ?? appState.session?.user.email {
        Text("您好，\(name)，以下是为您精选的匹配。")
          .font(.footnote)
          .foregroundColor(.secondary)
      }
    }
  }

  @ViewBuilder
  private var content: some View {
    if appState.recommendationsLoading && appState.recommendations.isEmpty {
      ProgressView("正在为您匹配…")
        .frame(maxWidth: .infinity)
        .padding(.top, 24)
    } else if let error = appState.recommendationError, appState.recommendations.isEmpty {
      VStack(spacing: 12) {
        Text(error.localizedDescription)
          .multilineTextAlignment(.center)
          .foregroundColor(.red)
        Button("重新请求") {
          Task { await appState.loadRecommendations(force: true) }
        }
      }
      .frame(maxWidth: .infinity, alignment: .center)
      .padding(.top, 24)
    } else if appState.recommendations.isEmpty {
      Text("暂无可显示的推荐，请稍后再试或补充更多资料。")
        .foregroundColor(.secondary)
        .padding(.top, 24)
    } else {
      List {
        ForEach(appState.recommendations) { recommendation in
          RecommendationRow(recommendation: recommendation)
            .listRowInsets(EdgeInsets(top: 10, leading: 16, bottom: 10, trailing: 16))
        }
      }
      .listStyle(.insetGrouped)
      .frame(maxWidth: .infinity, maxHeight: .infinity)
    }
  }

  private var refreshButton: some View {
    Button {
      Task { await appState.loadRecommendations(force: true) }
    } label: {
      HStack {
        Image(systemName: "arrow.clockwise")
        Text(appState.recommendations.isEmpty ? "获取推荐" : "刷新推荐")
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.borderedProminent)
    .disabled(appState.recommendationsLoading)
  }
}

private struct RecommendationRow: View {
  let recommendation: Recommendation

  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text(recommendation.company ?? recommendation.lenderName ?? "经纪人")
        .font(.headline)
      if let headline = recommendation.headline, !headline.isEmpty {
        Text(headline)
          .font(.subheadline)
          .foregroundColor(.secondary)
      }
      HStack(spacing: 12) {
        if let minRate = recommendation.minRate {
          Label(String(format: "利率 %.3f%%", minRate), systemImage: "percent")
        }
        if let maxLtv = recommendation.maxLoanToValue {
          Label("LTV \(maxLtv)%", systemImage: "chart.bar")
        }
        if let closing = recommendation.closingSpeedDays {
          Label("预计 \(closing) 天成交", systemImage: "clock")
        }
      }
      .font(.caption)
      .foregroundColor(.secondary)

      if !recommendation.loanPrograms.isEmpty {
        Text("项目：\(recommendation.loanPrograms.joined(separator: ", "))")
          .font(.caption)
          .foregroundColor(.secondary)
      }

      if let email = recommendation.contactEmail, !email.isEmpty {
        Label(email, systemImage: "envelope")
          .font(.caption)
          .foregroundColor(.secondary)
      }
      if let phone = recommendation.contactPhone, !phone.isEmpty {
        Label(phone, systemImage: "phone")
          .font(.caption)
          .foregroundColor(.secondary)
      }
    }
    .padding(.vertical, 6)
  }
}

private struct DealsView: View {
  @EnvironmentObject private var appState: AppState
  @State private var selectedDeal: DealCase?

  private var localeCode: String {
    if #available(iOS 16, *) {
      return Locale.current.language.languageCode?.identifier.lowercased().hasPrefix("zh") == true ? "zh" : "en"
    } else {
      return Locale.current.languageCode?.lowercased().hasPrefix("zh") == true ? "zh" : "en"
    }
  }

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: localeCode)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 16) {
      dealsHeader
      dealsContent
      refreshButton
    }
    .padding()
    .sheet(item: $selectedDeal) { deal in
      DealDetailView(deal: deal, localeCode: localeCode, onClose: { selectedDeal = nil })
    }
  }

  private var dealsHeader: some View {
    VStack(alignment: .leading, spacing: 4) {
      Text("真实成交案例")
        .font(.title3)
        .bold()
      Text(localeCode == "zh" ? "看看最近我们如何帮助客户完成融资。" : "See how borrowers closed with Golden Bridge.")
        .font(.footnote)
        .foregroundColor(.secondary)
    }
  }

  @ViewBuilder
  private var dealsContent: some View {
    if appState.dealCasesLoading && appState.dealCases.isEmpty {
      ProgressView("正在加载案例…")
        .frame(maxWidth: .infinity, alignment: .center)
        .padding(.top, 24)
    } else if let error = appState.dealCasesError, appState.dealCases.isEmpty {
      VStack(spacing: 12) {
        Text(error.localizedDescription)
          .multilineTextAlignment(.center)
          .foregroundColor(.red)
        Button("重新请求") {
          Task { await appState.loadDealCases(force: true) }
        }
      }
      .frame(maxWidth: .infinity, alignment: .center)
      .padding(.top, 24)
    } else if appState.dealCases.isEmpty {
      Text(localeCode == "zh" ? "暂时没有可展示的案例，请稍后再试。" : "No deal cases to display yet. Check back soon.")
        .foregroundColor(.secondary)
        .padding(.top, 24)
    } else {
      ScrollView {
        LazyVStack(spacing: 16) {
          ForEach(appState.dealCases) { deal in
            DealCardView(
              deal: deal,
              localeCode: localeCode,
              onTap: { selectedDeal = deal }
            )
          }
        }
        .padding(.vertical, 4)
      }
    }
  }

  private var refreshButton: some View {
    Button {
      Task { await appState.loadDealCases(force: true) }
    } label: {
      HStack {
        Image(systemName: "arrow.clockwise")
        Text(appState.dealCases.isEmpty ? (localeCode == "zh" ? "获取案例" : "Fetch Cases") : (localeCode == "zh" ? "刷新案例" : "Refresh Cases"))
      }
      .frame(maxWidth: .infinity)
    }
    .buttonStyle(.borderedProminent)
    .disabled(appState.dealCasesLoading)
  }
}

private struct DealCardView: View {
  let deal: DealCase
  let localeCode: String
  let onTap: () -> Void

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: localeCode)
  }

  var body: some View {
    Button(action: onTap) {
      VStack(alignment: .leading, spacing: 12) {
        ZStack(alignment: .bottomLeading) {
          AsyncImage(url: deal.heroImage.url) { phase in
            switch phase {
            case let .success(image):
              image
                .resizable()
                .scaledToFill()
            case .empty:
              Color.gray.opacity(0.2)
                .overlay(ProgressView().progressViewStyle(.circular))
            case .failure:
              Color.gray.opacity(0.2)
                .overlay(
                  Image(systemName: "photo")
                    .font(.largeTitle)
                    .foregroundColor(.gray)
                )
            @unknown default:
              Color.gray.opacity(0.2)
            }
          }
          .frame(height: 180)
          .clipped()
          .cornerRadius(16)

          LinearGradient(colors: [.black.opacity(0.6), .clear], startPoint: .bottom, endPoint: .center)
            .frame(height: 80)
            .cornerRadius(16)

          VStack(alignment: .leading, spacing: 4) {
            Text("\(deal.city), \(deal.state)")
              .font(.headline)
              .foregroundColor(.white)
            Text(deal.id)
              .font(.caption)
              .foregroundColor(.white.opacity(0.8))
          }
          .padding(12)
        }

        VStack(alignment: .leading, spacing: 8) {
          Text(localized(deal.price))
            .font(.title3)
            .fontWeight(.semibold)

          Text(localized(deal.timeline))
            .font(.caption)
            .foregroundColor(.secondary)

          Text(localized(deal.borrowerType))
            .font(.subheadline)

          VStack(alignment: .leading, spacing: 4) {
            Label(localized(deal.product), systemImage: "building.columns")
              .font(.caption)
            Label(localized(deal.highlight), systemImage: "sparkles")
              .font(.caption)
          }
          .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
      }
      .padding()
      .background(
        RoundedRectangle(cornerRadius: 20)
          .fill(Color(.systemBackground).opacity(0.9))
          .shadow(color: Color.black.opacity(0.1), radius: 10, x: 0, y: 4)
      )
    }
    .buttonStyle(.plain)
  }
}

private struct DealDetailView: View {
  let deal: DealCase
  let localeCode: String
  let onClose: () -> Void

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: localeCode)
  }

  var body: some View {
    NavigationStack {
      ScrollView {
        VStack(alignment: .leading, spacing: 16) {
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
                  .font(.largeTitle)
                  .foregroundColor(.gray)
              }
            @unknown default:
              Color.gray.opacity(0.2)
            }
          }
          .frame(height: 240)
          .clipped()
          .cornerRadius(20)

          VStack(alignment: .leading, spacing: 12) {
            Text("\(deal.city), \(deal.state)")
              .font(.title2)
              .fontWeight(.bold)
            Text(localized(deal.price))
              .font(.headline)
            Text(localized(deal.timeline))
              .font(.subheadline)
              .foregroundColor(.secondary)

            Divider()

            DetailRow(title: localeCode == "zh" ? "客户画像" : "Borrower Profile", value: localized(deal.borrowerType))
            DetailRow(title: localeCode == "zh" ? "贷款方案" : "Loan Program", value: localized(deal.product))
            DetailRow(title: localeCode == "zh" ? "成交亮点" : "Result Highlight", value: localized(deal.highlight))
          }

          if !deal.gallery.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
              Text(localeCode == "zh" ? "更多现场" : "Gallery")
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
                    .frame(width: 180, height: 120)
                    .clipped()
                    .cornerRadius(14)
                  }
                }
                .padding(.vertical, 4)
              }
            }
          }
        }
        .padding()
      }
      .navigationTitle(deal.id)
      .navigationBarTitleDisplayMode(.inline)
      .toolbar {
        ToolbarItem(placement: .confirmationAction) {
          Button(localeCode == "zh" ? "关闭" : "Close", action: onClose)
        }
      }
    }
  }

  private struct DetailRow: View {
    let title: String
    let value: String

    var body: some View {
      VStack(alignment: .leading, spacing: 4) {
        Text(title)
          .font(.caption)
          .foregroundColor(.secondary)
        Text(value)
          .font(.body)
      }
    }
  }
}

#Preview {
  ContentView()
    .environmentObject(AppState())
}
