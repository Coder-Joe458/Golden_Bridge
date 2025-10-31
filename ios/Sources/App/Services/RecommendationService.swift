import Foundation

struct RecommendationRequest: Codable {
  struct SummaryPayload: Codable {
    var location: String?
    var timeline: String?
    var priority: String?
    var credit: String?
    var amount: Double?
  }

  var summary: SummaryPayload
  var variant: Int = 0
}

@MainActor
final class RecommendationService {
  private let apiClient: APIClient
  private let encoder: JSONEncoder

  init(apiClient: APIClient) {
    self.apiClient = apiClient
    let encoder = JSONEncoder()
    encoder.dateEncodingStrategy = .iso8601
    self.encoder = encoder
  }

  func fetchRecommendations(summary: RecommendationRequest.SummaryPayload, variant: Int = 0) async throws -> [Recommendation] {
    let payload = RecommendationRequest(summary: summary, variant: variant)
    let body = try encoder.encode(payload)
    print("[Service] request RecommendationService -> /")
    let request = APIRequest(path: "api/recommendations", method: .post, headers: ["Content-Type": "application/json"], body: body)
    let response: RecommendationPayload = try await apiClient.send(request, responseType: RecommendationPayload.self)
    return response.recommendations
  }
}
