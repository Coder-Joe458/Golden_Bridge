import Foundation

@MainActor
final class DealCaseService {
  private let apiClient: APIClient

  init(apiClient: APIClient) {
    self.apiClient = apiClient
  }

  func fetchDealCases(limit: Int = 12) async throws -> [DealCase] {
    var path = "api/deal-cases"
    if limit > 0 {
      path.append("?limit=\(limit)")
    }
    let request = APIRequest(path: path)
    let payload: DealCasePayload = try await apiClient.send(request, responseType: DealCasePayload.self)
    return payload.cases
  }
}
