import Foundation

enum APIError: Error, LocalizedError {
  case invalidResponse
  case decodingFailed
  case unauthorized
  case message(String)

  var errorDescription: String? {
    switch self {
    case .invalidResponse: return "服务器响应无效。"
    case .decodingFailed: return "数据解析失败。"
    case .unauthorized: return "认证已过期，请重新登录。"
    case let .message(text): return text
    }
  }
}

struct UserSession: Codable {
  let user: SessionUser
}

struct SessionUser: Codable {
  let id: String
  let name: String?
  let email: String?
  let phoneNumber: String?
  let role: String?
}

struct ChatConversationPayload: Codable {
  let sessionId: String?
  let summary: Summary?
  let messages: [ChatMessage]?
}

struct Summary: Codable {
  let location: String?
  let timeline: String?
  let priority: String?
  let credit: String?
  let amount: Double?
}

enum MessageAuthor: String, Codable {
  case ai
  case user
  case system
}

struct ChatMessage: Codable, Identifiable {
  let id: String
  let author: MessageAuthor
  let content: String
}

struct ChatSendResponse: Codable {
  let message: String
  let sessionId: String
  let summary: Summary?
}

struct RecommendationPayload: Codable {
  let recommendations: [Recommendation]
  let total: Int
}

struct Recommendation: Codable, Identifiable {
  enum Category: String, Codable {
    case lowestRate
    case highestLtv
    case fastestClosing
    case additional
  }

  let id: String
  let category: Category
  let company: String?
  let headline: String?
  let notes: String?
  let licenseStates: [String]
  let minRate: Double?
  let maxRate: Double?
  let loanPrograms: [String]
  let minCreditScore: Int?
  let maxLoanToValue: Int?
  let yearsExperience: Int?
  let website: String?
  let lenderName: String?
  let contactEmail: String?
  let contactPhone: String?
  let closingSpeedDays: Int?
}

struct ChatConversation {
  var sessionId: String?
  var summary: Summary?
  var messages: [ChatMessage]
}
