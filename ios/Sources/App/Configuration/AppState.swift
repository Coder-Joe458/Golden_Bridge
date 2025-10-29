import Foundation

@MainActor
final class AppState: ObservableObject {
  @Published var session: UserSession?
  @Published var isAuthenticating = false
  @Published var authenticationError: Error?

  @Published var chatConversation: ChatConversation?
  @Published var isChatLoading = false
  @Published var chatError: Error?
  @Published var isSendingMessage = false

  @Published var recommendations: [Recommendation] = []
  @Published var recommendationsLoading = false
  @Published var recommendationError: Error?

  private let authService: AuthService
  private let recommendationService: RecommendationService
  private let chatService: ChatService
  private let configuration: AppConfiguration

  private var hasBootstrapped = false

  init(configuration: AppConfiguration = .shared) {
    self.configuration = configuration
    let apiClient = APIClient(configuration: configuration)
    self.authService = AuthService(apiClient: apiClient, configuration: configuration)
    self.recommendationService = RecommendationService(apiClient: apiClient)
    self.chatService = ChatService(apiClient: apiClient)
  }

  func bootstrapIfNeeded() async {
    guard !hasBootstrapped else { return }
    hasBootstrapped = true
    await refreshSession()
  }

  func refreshSession() async {
    do {
      if let session = try await authService.fetchSession() {
        self.session = session
        await loadChat(force: true)
        await loadRecommendations(force: true)
      } else {
        clearSessionState()
      }
    } catch {
      clearSessionState()
    }
  }

  func signIn(identifier: String, password: String) async {
    guard !identifier.isEmpty, !password.isEmpty else { return }
    isAuthenticating = true
    authenticationError = nil
    do {
      let session = try await authService.signIn(identifier: identifier, password: password)
      self.session = session
      await loadChat(force: true)
      await loadRecommendations(force: true)
    } catch {
      authenticationError = error
    }
    isAuthenticating = false
  }

  func signOut() async {
    await authService.signOut()
    clearSessionState()
  }

  func loadChat(force: Bool = false) async {
    guard session != nil else {
      chatConversation = nil
      return
    }
    if isChatLoading && !force { return }
    isChatLoading = true
    chatError = nil

    do {
      let payload = try await chatService.loadSession()
      let messages = payload.messages ?? []
      chatConversation = ChatConversation(
        sessionId: payload.sessionId,
        summary: payload.summary,
        messages: messages
      )
    } catch {
      chatError = error
    }

    isChatLoading = false
  }

  func resetChat() async {
    guard session != nil else { return }
    isChatLoading = true
    chatError = nil
    do {
      let payload = try await chatService.resetSession()
      chatConversation = ChatConversation(sessionId: payload.sessionId, summary: payload.summary, messages: payload.messages ?? [])
    } catch {
      chatError = error
    }
    isChatLoading = false
  }

  func sendChatMessage(_ text: String) async {
    let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
    guard !trimmed.isEmpty, session != nil else { return }

    isSendingMessage = true
    chatError = nil

    var pendingConversation = chatConversation ?? ChatConversation(sessionId: nil, summary: nil, messages: [])
    let userMessage = ChatMessage(id: UUID().uuidString, author: .user, content: trimmed)
    let userMessageId = userMessage.id
    pendingConversation.messages.append(userMessage)
    chatConversation = pendingConversation

    do {
      let response = try await chatService.sendMessage(
        sessionId: chatConversation?.sessionId,
        message: trimmed,
        summary: chatConversation?.summary,
        pointer: 0,
        shouldRecap: false,
        locale: resolvedLocaleCode()
      )
      var updatedConversation = chatConversation ?? ChatConversation(sessionId: response.sessionId, summary: response.summary, messages: [])
      updatedConversation.sessionId = response.sessionId
      updatedConversation.summary = response.summary
      updatedConversation.messages.append(ChatMessage(id: UUID().uuidString, author: .ai, content: response.message))
      chatConversation = updatedConversation
      await loadChat(force: true) // refresh to sync timestamps and ids from server
      await loadRecommendations(force: true)
    } catch {
      chatError = error
      if var conversation = chatConversation {
        conversation.messages.removeAll { $0.id == userMessageId }
        chatConversation = conversation
      }
    }

    isSendingMessage = false
  }

  func loadRecommendations(force: Bool = false) async {
    guard session != nil else {
      recommendations = []
      return
    }
    if recommendationsLoading && !force { return }
    recommendationsLoading = true
    recommendationError = nil

    do {
      let summaryPayload = RecommendationRequest.SummaryPayload(
        location: chatConversation?.summary?.location,
        timeline: chatConversation?.summary?.timeline,
        priority: chatConversation?.summary?.priority,
        credit: chatConversation?.summary?.credit,
        amount: chatConversation?.summary?.amount
      )
      recommendations = try await recommendationService.fetchRecommendations(summary: summaryPayload)
    } catch {
      recommendationError = error
    }

    recommendationsLoading = false
  }

  private func clearSessionState() {
    session = nil
    recommendations = []
    chatConversation = nil
    authenticationError = nil
  }

  private func resolvedLocaleCode() -> String {
    if #available(iOS 16, *) {
      if Locale.current.language.languageCode?.identifier.lowercased().hasPrefix("zh") == true {
        return "zh"
      }
    } else if Locale.current.languageCode?.lowercased().hasPrefix("zh") == true {
      return "zh"
    }
    return "en"
  }
}
