import SwiftUI

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

  let localeCode: String
  let onSignIn: () -> Void
  let onSignOut: () -> Void

  @State private var messageDraft: String = ""
  @State private var showingDeal: DealCase?

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private var questionPrompts: [String] {
    if isChinese {
      return [
        "您计划贷款购买的房产在哪里？请告诉我城市、州或邮编。",
        "预计什么时候完成贷款？是否已经签署购房合同？",
        "贷款中您最看重哪些条件？例如：利率、贷款成数、放款速度或资料要求。"
      ]
    }
    return [
      "Where is the property you plan to finance? Let me know the city, state, or zip code.",
      "What timeline are you targeting for closing? Have you already signed a purchase contract?",
      "Which loan factors matter the most to you? Rate, leverage, speed, or documentation?"
    ]
  }

  private var defaultMessages: [ChatMessage] {
    [
      ChatMessage(
        id: "intro-ai",
        author: .ai,
        content: isChinese
          ? "您好，我是金桥 AI 信贷顾问，我们会一步步梳理您的贷款需求。"
          : "Welcome to Golden Bridge. I'm your AI lending partner—let's chart the ideal financing plan."
      ),
      ChatMessage(
        id: "intro-question",
        author: .ai,
        content: questionPrompts.first ?? ""
      )
    ]
  }

  private var messages: [ChatMessage] {
    let chatMessages = appState.chatConversation?.messages ?? []
    return chatMessages.isEmpty ? defaultMessages : chatMessages
  }

  var body: some View {
    ZStack {
      Color(red: 4 / 255, green: 9 / 255, blue: 28 / 255)
        .ignoresSafeArea()

      ScrollView {
        VStack(alignment: .leading, spacing: 28) {
          HeroSection(
            localeCode: localeCode,
            session: appState.session,
            summary: appState.chatConversation?.summary,
            onPrimaryAction: {
              if appState.session == nil {
                onSignIn()
              } else {
                Task { await appState.loadChat(force: true) }
              }
            },
            onSignIn: onSignIn,
            onSignOut: onSignOut
          )

          ChatConsoleSection(
            localeCode: localeCode,
            messages: messages,
            isLoading: appState.isChatLoading,
            messageDraft: $messageDraft,
            onQuickPrompt: { prompt in
              if appState.session == nil {
                onSignIn()
              } else {
                messageDraft = prompt
              }
            },
            onSend: { draft in
              let trimmed = draft.trimmingCharacters(in: .whitespacesAndNewlines)
              guard !trimmed.isEmpty else { return }
              if appState.session == nil {
                onSignIn()
              } else {
                Task { await appState.sendChatMessage(trimmed) }
              }
            },
            questions: questionPrompts,
            error: appState.chatError,
            onRetry: {
              Task { await appState.loadChat(force: true) }
            },
            onReset: {
              Task { await appState.resetChat() }
            }
          )

          SummaryPanel(localeCode: localeCode, summary: appState.chatConversation?.summary)

          RecommendationSection(
            localeCode: localeCode,
            recommendations: appState.recommendations,
            isLoading: appState.recommendationsLoading,
            error: appState.recommendationError?.localizedDescription,
            onRefresh: {
              Task { await appState.loadRecommendations(force: true) }
            }
          )

          DealsSection(
            localeCode: localeCode,
            deals: appState.dealCases,
            isLoading: appState.dealCasesLoading,
            error: appState.dealCasesError,
            onSelect: { showingDeal = $0 }
          )
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 32)
      }
    }
    .sheet(item: $showingDeal) { deal in
      DealDetailView(deal: deal, localeCode: localeCode) {
        showingDeal = nil
      }
    }
  }
}

// MARK: - Hero Section

private struct HeroSection: View {
  let localeCode: String
  let session: UserSession?
  let summary: Summary?
  let onPrimaryAction: () -> Void
  let onSignIn: () -> Void
  let onSignOut: () -> Void

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private let metrics = ["Rate", "Speed", "Documentation", "Broker Fit", "Success", "Closing Confidence"]

  private func metricScore(_ label: String) -> String {
    var hash = 0
    for scalar in label.unicodeScalars {
      hash = (hash << 5) - hash + Int(scalar.value)
    }
    let base = 85
    let range = 15
    let value = base + abs(hash) % range
    return "\(value)"
  }

  private var greeting: String {
    if let name = session?.user.name, !name.isEmpty {
      return isChinese ? "欢迎回来，\(name)" : "Welcome back, \(name)"
    }
    return isChinese ? "欢迎来到金桥 AI 信贷顾问" : "Welcome to Golden Bridge AI"
  }

  private var subheadline: String {
    if isChinese {
      return "实时梳理贷款需求、智能撮合经纪人，随时刷新最新匹配。"
    }
    return "Capture lending needs in real-time, match with elite brokers, and refresh insights on demand."
  }

  private var primaryCTA: String {
    if session == nil {
      return isChinese ? "登录以继续" : "Sign in to continue"
    }
    return isChinese ? "刷新匹配" : "Refresh matches"
  }

  private var secondaryCTA: String {
    session == nil ? (isChinese ? "没有账号？网页端注册" : "Need an account? Sign up on the web") : ""
  }

  private var summaryRows: [SummaryRow] {
    guard let summary else { return [] }
    var rows: [SummaryRow] = []
    if let location = summary.location, !location.isEmpty {
      rows.append(
        SummaryRow(
          title: isChinese ? "目标区域" : "Target Market",
          value: location
        )
      )
    }
    if let amount = summary.amount, amount > 0 {
      let formatted = NumberFormatter.currency(localeCode: localeCode).string(from: NSNumber(value: amount)) ?? ""
      rows.append(
        SummaryRow(
          title: isChinese ? "目标贷款" : "Loan Target",
          value: formatted
        )
      )
    }
    if let credit = summary.credit, !credit.isEmpty {
      rows.append(
        SummaryRow(
          title: isChinese ? "信用分" : "Credit Score",
          value: credit
        )
      )
    }
    if let priority = summary.priority {
      let label: String
      switch priority {
      case "rate": label = isChinese ? "锁定最低利率" : "Lowest rate focus"
      case "ltv": label = isChinese ? "争取最高成数" : "Max leverage"
      case "speed": label = isChinese ? "追求最快放款" : "Fastest closing"
      case "documents": label = isChinese ? "简化资料要求" : "Streamlined docs"
      default: label = priority.capitalized
      }
      rows.append(
        SummaryRow(
          title: isChinese ? "优先事项" : "Priority",
          value: label
        )
      )
    }
    if let timeline = summary.timeline, !timeline.isEmpty {
      rows.append(
        SummaryRow(
          title: isChinese ? "时间线" : "Timeline",
          value: timeline
        )
      )
    }
    return rows
  }

  var body: some View {
    ZStack {
      LinearGradient(
        colors: [
          Color(red: 8 / 255, green: 16 / 255, blue: 52 / 255),
          Color(red: 2 / 255, green: 3 / 255, blue: 15 / 255)
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
      )
      .clipShape(RoundedRectangle(cornerRadius: 36, style: .continuous))
      .overlay(
        RoundedRectangle(cornerRadius: 36, style: .continuous)
          .stroke(Color.white.opacity(0.08), lineWidth: 1)
      )

      VStack(alignment: .leading, spacing: 24) {
        HStack {
          Text("Golden Bridge")
            .font(.system(size: 13, weight: .semibold))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.08))
            .clipShape(Capsule())

          Spacer()

          if session == nil {
            Button(isChinese ? "登录" : "Sign in") {
              onSignIn()
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(.white)
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.08))
            .clipShape(Capsule())
          } else {
            Button(isChinese ? "退出" : "Sign out") {
              onSignOut()
            }
            .font(.system(size: 14, weight: .semibold))
            .foregroundColor(.white.opacity(0.8))
            .padding(.horizontal, 12)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.06))
            .clipShape(Capsule())
          }
        }

        VStack(alignment: .leading, spacing: 12) {
          Text(greeting)
            .font(.system(size: 26, weight: .bold))
            .foregroundColor(.white)
            .multilineTextAlignment(.leading)
          Text(subheadline)
            .font(.system(size: 15))
            .foregroundColor(Color.white.opacity(0.65))
        }

        if !summaryRows.isEmpty {
          VStack(alignment: .leading, spacing: 10) {
            Text(isChinese ? "当前画像" : "Borrower profile")
              .font(.system(size: 13, weight: .medium))
              .foregroundColor(Color.white.opacity(0.6))
            VStack(alignment: .leading, spacing: 8) {
              ForEach(summaryRows) { row in
                HStack {
                  Text(row.title)
                    .foregroundColor(Color.white.opacity(0.55))
                  Spacer()
                  Text(row.value)
                    .foregroundColor(.white)
                }
                .font(.system(size: 13))
                .padding(.vertical, 6)
                .padding(.horizontal, 12)
                .background(Color.white.opacity(0.05))
                .clipShape(Capsule())
              }
            }
          }
        }

        Button(action: onPrimaryAction) {
          Text(primaryCTA)
            .font(.system(size: 15, weight: .semibold))
            .padding(.vertical, 14)
            .frame(maxWidth: .infinity)
            .background(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
            .foregroundColor(Color(red: 6 / 255, green: 20 / 255, blue: 29 / 255))
            .clipShape(Capsule())
        }
        .shadow(color: Color.black.opacity(0.25), radius: 20, x: 0, y: 14)

        if !secondaryCTA.isEmpty {
          Text(secondaryCTA)
            .font(.system(size: 12))
            .foregroundColor(Color.white.opacity(0.5))
        }

        LazyVGrid(
          columns: Array(repeating: GridItem(.flexible(), spacing: 12), count: 3),
          spacing: 12
        ) {
          ForEach(metrics, id: \.self) { metric in
            VStack(alignment: .leading, spacing: 4) {
              Text(metricScore(metric))
                .font(.system(size: 20, weight: .bold, design: .rounded))
                .foregroundColor(.white)
              Text(isChinese ? localizedMetric(metric) : metric)
                .font(.system(size: 11))
                .foregroundColor(Color.white.opacity(0.55))
            }
            .padding()
            .frame(maxWidth: .infinity, alignment: .leading)
            .background(Color.white.opacity(0.06))
            .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
          }
        }
      }
      .padding(24)
    }
  }

  private struct SummaryRow: Identifiable {
    let id = UUID()
    let title: String
    let value: String
  }

  private func localizedMetric(_ metric: String) -> String {
    switch metric {
    case "Rate": return "利率优势"
    case "Speed": return "放款速度"
    case "Documentation": return "资料精简"
    case "Broker Fit": return "经纪匹配"
    case "Success": return "成交胜率"
    case "Closing Confidence": return "成交信心"
    default: return metric
    }
  }
}

// MARK: - Chat Console

private struct ChatConsoleSection: View {
  let localeCode: String
  let messages: [ChatMessage]
  let isLoading: Bool
  @Binding var messageDraft: String
  let onQuickPrompt: (String) -> Void
  let onSend: (String) -> Void
  let questions: [String]
  let error: Error?
  let onRetry: () -> Void
  let onReset: () -> Void

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        VStack(alignment: .leading, spacing: 4) {
          Text(isChinese ? "AI 策略对话" : "AI Guidance Console")
            .font(.system(size: 18, weight: .semibold))
            .foregroundColor(.white)
          Text(isChinese ? "实时梳理贷款需求，生成个性化匹配。" : "Capture borrower signals and orchestrate tailored matches.")
            .font(.system(size: 13))
            .foregroundColor(Color.white.opacity(0.6))
        }
        Spacer()
        Button(isChinese ? "重置" : "Reset") {
          onReset()
        }
        .font(.system(size: 13, weight: .medium))
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color.white.opacity(0.08))
        .clipShape(Capsule())
      }

      ChatTranscriptView(messages: messages, isChinese: isChinese)
        .frame(minHeight: 220, maxHeight: 340)

      if let error {
        HStack {
          Image(systemName: "exclamationmark.triangle.fill")
            .foregroundColor(.orange)
          Text(error.localizedDescription)
            .foregroundColor(.orange)
            .font(.system(size: 12))
          Spacer()
          Button(isChinese ? "重试" : "Retry", action: onRetry)
            .font(.system(size: 12, weight: .semibold))
        }
        .padding(12)
        .background(Color.orange.opacity(0.12))
        .clipShape(RoundedRectangle(cornerRadius: 16, style: .continuous))
      }

      VStack(alignment: .leading, spacing: 12) {
        Text(isChinese ? "快速补充要点" : "Suggested prompts")
          .font(.system(size: 12))
          .foregroundColor(Color.white.opacity(0.6))
        WrapView(data: questions, spacing: 8) { prompt in
          Button {
            onQuickPrompt(prompt)
          } label: {
            Text(prompt)
              .font(.system(size: 12))
              .foregroundColor(.white)
              .padding(.horizontal, 12)
              .padding(.vertical, 8)
              .background(Color.white.opacity(0.08))
              .clipShape(Capsule())
          }
        }
      }

      VStack(spacing: 12) {
        TextEditor(text: $messageDraft)
          .frame(minHeight: 80, maxHeight: 140)
          .padding(12)
          .background(Color.white.opacity(0.06))
          .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
          .overlay(
            RoundedRectangle(cornerRadius: 18, style: .continuous)
              .stroke(Color.white.opacity(0.08), lineWidth: 1)
          )
          .foregroundColor(.white)
          .font(.system(size: 15))

        Button {
          onSend(messageDraft)
          messageDraft = ""
        } label: {
          if isLoading {
            ProgressView()
              .progressViewStyle(.circular)
              .tint(Color(red: 6 / 255, green: 20 / 255, blue: 29 / 255))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
          } else {
            Text(isChinese ? "发送" : "Send")
              .font(.system(size: 15, weight: .semibold))
              .frame(maxWidth: .infinity)
              .padding(.vertical, 14)
          }
        }
        .disabled(messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty || isLoading)
        .buttonStyle(.plain)
        .background(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
        .foregroundColor(Color(red: 6 / 255, green: 20 / 255, blue: 29 / 255))
        .clipShape(Capsule())
        .opacity(messageDraft.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty ? 0.7 : 1)
      }
    }
    .padding(24)
    .background(Color.white.opacity(0.04))
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct ChatTranscriptView: View {
  let messages: [ChatMessage]
  let isChinese: Bool

  var body: some View {
    ScrollViewReader { proxy in
      ScrollView {
        LazyVStack(alignment: .leading, spacing: 12) {
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
          withAnimation {
            proxy.scrollTo(last, anchor: .bottom)
          }
        }
      }
    }
  }
}

private struct ChatBubbleView: View {
  let message: ChatMessage
  let isChinese: Bool

  private var isUser: Bool { message.author == .user }

  var body: some View {
    HStack(spacing: 12) {
      if isUser { Spacer(minLength: 32) }
      VStack(alignment: .leading, spacing: 6) {
        Text(message.content)
          .font(.system(size: 15))
          .foregroundColor(isUser ? Color(red: 6 / 255, green: 20 / 255, blue: 29 / 255) : .white)
          .multilineTextAlignment(.leading)
      }
      .padding(.horizontal, 16)
      .padding(.vertical, 12)
      .background(
        LinearGradient(
          colors: isUser
            ? [Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255), Color(red: 34 / 255, green: 211 / 255, blue: 238 / 255)]
            : [Color.white.opacity(0.08), Color.white.opacity(0.05)],
          startPoint: .topLeading,
          endPoint: .bottomTrailing
        )
      )
      .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
      if !isUser { Spacer(minLength: 32) }
    }
    .transition(.move(edge: isUser ? .trailing : .leading).combined(with: .opacity))
  }
}

// MARK: - Summary Panel

private struct SummaryPanel: View {
  let localeCode: String
  let summary: Summary?

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private var items: [SummaryItem] {
    guard let summary else { return [] }
    var data: [SummaryItem] = []
    if let location = summary.location, !location.isEmpty {
      data.append(SummaryItem(icon: "mappin.and.ellipse", title: isChinese ? "区域" : "Location", value: location))
    }
    if let amount = summary.amount, amount > 0 {
      let formatted = NumberFormatter.currency(localeCode: localeCode).string(from: NSNumber(value: amount)) ?? ""
      data.append(SummaryItem(icon: "dollarsign.circle", title: isChinese ? "额度" : "Loan amount", value: formatted))
    }
    if let credit = summary.credit, !credit.isEmpty {
      data.append(SummaryItem(icon: "gauge.with.dots.needle.bottom", title: isChinese ? "信用分" : "Credit score", value: credit))
    }
    if let priority = summary.priority {
      let text: String
      switch priority {
      case "rate": text = isChinese ? "利率优先" : "Rate focus"
      case "ltv": text = isChinese ? "高成数" : "Leverage focus"
      case "speed": text = isChinese ? "极速放款" : "Speed focus"
      case "documents": text = isChinese ? "简化资料" : "Low-doc priority"
      default: text = priority.capitalized
      }
      data.append(SummaryItem(icon: "star.circle", title: isChinese ? "偏好" : "Priority", value: text))
    }
    if let timeline = summary.timeline, !timeline.isEmpty {
      data.append(SummaryItem(icon: "calendar", title: isChinese ? "时间线" : "Timeline", value: timeline))
    }
    return data
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack {
        Text(isChinese ? "资料摘要" : "Profile snapshot")
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.white)
        Spacer()
        Text(isChinese ? "自动同步推荐引擎" : "Synced to recommendation engine")
          .font(.system(size: 12))
          .foregroundColor(Color.white.opacity(0.45))
      }

      if items.isEmpty {
        Text(isChinese ? "分享更多需求，AI 将自动生成专属推荐。" : "Share more details to unlock tailored recommendations.")
          .font(.system(size: 13))
          .foregroundColor(Color.white.opacity(0.55))
          .padding()
          .frame(maxWidth: .infinity, alignment: .leading)
          .background(Color.white.opacity(0.04))
          .clipShape(RoundedRectangle(cornerRadius: 20, style: .continuous))
      } else {
        VStack(spacing: 10) {
          ForEach(items) { item in
            HStack(spacing: 12) {
              Image(systemName: item.icon)
                .font(.system(size: 16))
                .foregroundColor(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
              VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                  .font(.system(size: 13))
                  .foregroundColor(Color.white.opacity(0.6))
                Text(item.value)
                  .font(.system(size: 15, weight: .medium))
                  .foregroundColor(.white)
              }
              Spacer()
            }
            .padding()
            .background(Color.white.opacity(0.05))
            .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))
          }
        }
      }
    }
    .padding(24)
    .background(Color.white.opacity(0.04))
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }

  private struct SummaryItem: Identifiable {
    let id = UUID()
    let icon: String
    let title: String
    let value: String
  }
}

// MARK: - Recommendations

private struct RecommendationSection: View {
  let localeCode: String
  let recommendations: [Recommendation]
  let isLoading: Bool
  let error: String?
  let onRefresh: () -> Void

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      HStack {
        Text(isChinese ? "精选匹配" : "Top matches")
          .font(.system(size: 16, weight: .semibold))
          .foregroundColor(.white)
        Spacer()
        Button(isChinese ? "刷新" : "Refresh") {
          onRefresh()
        }
        .font(.system(size: 13, weight: .medium))
        .foregroundColor(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
      }

      if isLoading {
        ProgressView()
          .progressViewStyle(.circular)
          .tint(.white)
          .padding(.vertical, 24)
      } else if let error {
        Text(error)
          .font(.system(size: 13))
          .foregroundColor(Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255))
          .padding(.vertical, 16)
      } else if recommendations.isEmpty {
        Text(isChinese ? "暂无匹配，请补充更多需求信息。" : "No matches yet—share more data to unlock recommendations.")
          .font(.system(size: 13))
          .foregroundColor(Color.white.opacity(0.55))
          .padding(.vertical, 16)
      } else {
        VStack(spacing: 16) {
          ForEach(recommendations) { broker in
            RecommendationCard(localeCode: localeCode, recommendation: broker)
          }
        }
      }
    }
    .padding(24)
    .background(Color.white.opacity(0.04))
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct RecommendationCard: View {
  let localeCode: String
  let recommendation: Recommendation

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private var badge: String {
    switch recommendation.category {
    case .lowestRate: return isChinese ? "低利率" : "Low rate"
    case .highestLtv: return isChinese ? "高成数" : "High LTV"
    case .fastestClosing: return isChinese ? "放款快" : "Fast close"
    case .additional: return isChinese ? "备选" : "Alternate"
    }
  }

  private var companyLine: String {
    recommendation.company ?? recommendation.lenderName ?? (isChinese ? "精选贷款方" : "Curated lender")
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
      HStack(alignment: .top) {
        VStack(alignment: .leading, spacing: 6) {
          Text(companyLine)
            .font(.system(size: 15, weight: .semibold))
            .foregroundColor(.white)
          Text(recommendation.licenseStates.isEmpty
            ? (isChinese ? "全国可协助" : "Nationwide availability")
            : recommendation.licenseStates.joined(separator: ", "))
            .font(.system(size: 11))
            .foregroundColor(Color.white.opacity(0.5))
        }
        Spacer()
        Text(badge)
          .font(.system(size: 11, weight: .medium))
          .padding(.horizontal, 10)
          .padding(.vertical, 6)
          .background(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255).opacity(0.2))
          .foregroundColor(Color(red: 54 / 255, green: 232 / 255, blue: 255 / 255))
          .clipShape(Capsule())
      }

      if let headline = recommendation.headline, !headline.isEmpty {
        Text(isChinese ? translateHeadline(headline) : headline)
          .font(.system(size: 13))
          .foregroundColor(.white)
      }

      if !recommendation.loanPrograms.isEmpty {
        WrapView(data: Array(recommendation.loanPrograms.prefix(4)), spacing: 8) { program in
          Text(isChinese ? translateProgram(program) : program)
            .font(.system(size: 11))
            .foregroundColor(Color.white.opacity(0.8))
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(Color.white.opacity(0.08))
            .clipShape(Capsule())
        }
      }
    }
    .padding(18)
    .background(Color.white.opacity(0.06))
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }

  private func translateHeadline(_ text: String) -> String {
    let normalized = text.replacingOccurrences(of: "\\s+", with: " ", options: .regularExpression)
    let dictionary: [String: String] = [
      "Tech professional and startup-friendly jumbo lending across Northern California": "专注北加州科技及创业客户的大额贷款团队",
      "SoCal purchase and refinance specialist with investor solutions": "南加州购房与再融资专家，兼顾投资需求",
      "Specialist in coastal condos and vacation homes": "擅长海岸公寓与度假房贷项目"
    ]
    return dictionary[normalized] ?? text
  }

  private func translateProgram(_ program: String) -> String {
    let normalized = program.lowercased()
    if normalized.contains("jumbo") { return "大额贷款" }
    if normalized.contains("bridge") { return "过桥贷款" }
    if normalized.contains("arm") { return "可调利率 ARM" }
    if normalized.contains("dscr") { return "DSCR 现金流贷款" }
    if normalized.contains("bank") { return "银行流水贷款" }
    if normalized.contains("vacation") || normalized.contains("rental") { return "度假/短租贷款" }
    return program
  }
}

// MARK: - Deals Section

private struct DealsSection: View {
  let localeCode: String
  let deals: [DealCase]
  let isLoading: Bool
  let error: Error?
  let onSelect: (DealCase) -> Void

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  var body: some View {
    VStack(alignment: .leading, spacing: 18) {
      Text(isChinese ? "成交案例" : "Recent deal wins")
        .font(.system(size: 16, weight: .semibold))
        .foregroundColor(.white)

      if isLoading {
        ProgressView()
          .progressViewStyle(.circular)
          .tint(.white)
          .padding(.vertical, 24)
      } else if let error {
        Text(error.localizedDescription)
          .font(.system(size: 13))
          .foregroundColor(Color(red: 248 / 255, green: 113 / 255, blue: 113 / 255))
      } else if deals.isEmpty {
        Text(isChinese ? "加载中或暂无案例，稍后再来看看。" : "No deal stories yet—check back soon.")
          .font(.system(size: 13))
          .foregroundColor(Color.white.opacity(0.55))
      } else {
        ScrollView(.horizontal, showsIndicators: false) {
          HStack(spacing: 16) {
            ForEach(deals) { deal in
              DealCard(localeCode: localeCode, deal: deal)
                .frame(width: 240)
                .onTapGesture {
                  onSelect(deal)
                }
            }
          }
          .padding(.horizontal, 4)
        }
      }
    }
    .padding(24)
    .background(Color.white.opacity(0.04))
    .clipShape(RoundedRectangle(cornerRadius: 28, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 28, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

private struct DealCard: View {
  let localeCode: String
  let deal: DealCase

  private var isChinese: Bool { localeCode.hasPrefix("zh") }

  private func localized(_ copy: LocalizedCopy) -> String {
    copy.text(for: localeCode)
  }

  var body: some View {
    VStack(alignment: .leading, spacing: 12) {
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
      .frame(height: 140)
      .clipShape(RoundedRectangle(cornerRadius: 18, style: .continuous))

      Text("\(deal.city), \(deal.state)")
        .font(.system(size: 15, weight: .semibold))
        .foregroundColor(.white)

      VStack(alignment: .leading, spacing: 6) {
        if !localized(deal.price).isEmpty {
          Text(localized(deal.price))
            .font(.system(size: 13, weight: .medium))
            .foregroundColor(Color.white.opacity(0.9))
        }
        if !localized(deal.timeline).isEmpty {
          Text(localized(deal.timeline))
            .font(.system(size: 12))
            .foregroundColor(Color.white.opacity(0.6))
        }
      }

      Text(localized(deal.highlight))
        .font(.system(size: 12))
        .foregroundColor(Color.white.opacity(0.7))
        .lineLimit(3)
    }
    .padding(16)
    .frame(maxWidth: .infinity, alignment: .leading)
    .background(Color.white.opacity(0.05))
    .clipShape(RoundedRectangle(cornerRadius: 24, style: .continuous))
    .overlay(
      RoundedRectangle(cornerRadius: 24, style: .continuous)
        .stroke(Color.white.opacity(0.08), lineWidth: 1)
    )
  }
}

// MARK: - Deal Detail

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

            DetailRow(title: localeCode.hasPrefix("zh") ? "客户画像" : "Borrower profile", value: localized(deal.borrowerType))
            DetailRow(title: localeCode.hasPrefix("zh") ? "贷款方案" : "Loan program", value: localized(deal.product))
            DetailRow(title: localeCode.hasPrefix("zh") ? "成交亮点" : "Result highlight", value: localized(deal.highlight))
          }

          if !deal.gallery.isEmpty {
            VStack(alignment: .leading, spacing: 8) {
              Text(localeCode.hasPrefix("zh") ? "更多现场" : "Gallery")
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
          Button(localeCode.hasPrefix("zh") ? "关闭" : "Close", action: onClose)
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

private struct WrapView<Data: RandomAccessCollection, Content: View>: View where Data.Element: Hashable {
  let data: Data
  let spacing: CGFloat
  let content: (Data.Element) -> Content

  init(data: Data, spacing: CGFloat, @ViewBuilder content: @escaping (Data.Element) -> Content) {
    self.data = data
    self.spacing = spacing
    self.content = content
  }

  var body: some View {
    GeometryReader { geometry in
      var width = CGFloat.zero
      var height = CGFloat.zero
      ZStack(alignment: .topLeading) {
        ForEach(Array(data), id: \.self) { element in
          content(element)
            .alignmentGuide(.leading) { dimension in
              if abs(width - dimension.width) > geometry.size.width {
                width = 0
                height -= dimension.height + spacing
              }
              let result = width
              if element == data.last {
                width = 0
              } else {
                width -= dimension.width + spacing
              }
              return result
            }
            .alignmentGuide(.top) { _ in
              defer {
                if element == data.last {
                  height = 0
                }
              }
              let result = height
              return result
            }
        }
      }
    }
    .frame(minHeight: 0, maxHeight: .infinity, alignment: .topLeading)
  }
}

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
