import Foundation

final class ChatService {
  private let apiClient: APIClient
  private let encoder: JSONEncoder

  init(apiClient: APIClient) {
    self.apiClient = apiClient
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    self.encoder = encoder
  }

  func loadSession() async throws -> ChatConversationPayload {
    let request = APIRequest(path: "api/chat/session")
    return try await apiClient.send(request, responseType: ChatConversationPayload.self)
  }

  func resetSession() async throws -> ChatConversationPayload {
    let body = try encoder.encode(["action": "reset"])
    let request = APIRequest(path: "api/chat/session", method: .post, headers: ["Content-Type": "application/json"], body: body)
    return try await apiClient.send(request, responseType: ChatConversationPayload.self)
  }

  func sendMessage(
    sessionId: String?,
    message: String,
    summary: Summary?,
    pointer: Int,
    shouldRecap: Bool,
    locale: String
  ) async throws -> ChatSendResponse {
    struct ChatRequestPayload: Encodable {
      let sessionId: String?
      let message: String
      let summary: Summary?
      let pointer: Int
      let shouldRecap: Bool
      let locale: String
    }

    let payload = ChatRequestPayload(
      sessionId: sessionId,
      message: message,
      summary: summary,
      pointer: pointer,
      shouldRecap: shouldRecap,
      locale: locale
    )

    let body = try encoder.encode(payload)
    let request = APIRequest(path: "api/chat", method: .post, headers: ["Content-Type": "application/json"], body: body)
    return try await apiClient.send(request, responseType: ChatSendResponse.self)
  }
}
