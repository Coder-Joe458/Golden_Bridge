import Foundation

@MainActor
final class DealCaseService {
  private let apiClient: APIClient

  init(apiClient: APIClient) {
    self.apiClient = apiClient
  }

  func fetchDealCases(limit: Int = 12) async throws -> [DealCase] {
    let request = APIRequest(
      path: "api/deal-cases",
      queryItems: limit > 0 ? [URLQueryItem(name: "limit", value: String(limit))] : nil
    )
    let payload: DealCasePayload = try await apiClient.send(request, responseType: DealCasePayload.self)
    return payload.cases
  }
}
