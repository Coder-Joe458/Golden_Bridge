import Foundation

enum HTTPMethod: String {
  case get = "GET"
  case post = "POST"
}

struct APIRequest {
  let path: String
  var method: HTTPMethod = .get
  var headers: [String: String] = [:]
  var body: Data? = nil

  init(path: String, method: HTTPMethod = .get, headers: [String: String] = [:], body: Data? = nil) {
    self.path = path
    self.method = method
    self.headers = headers
    self.body = body
  }
}

final class APIClient {
  private let configuration: AppConfiguration
  private let session: URLSession
  private let decoder: JSONDecoder

  init(configuration: AppConfiguration) {
    self.configuration = configuration
    let sessionConfiguration = URLSessionConfiguration.default
    sessionConfiguration.requestCachePolicy = .reloadIgnoringLocalCacheData
    sessionConfiguration.httpCookieAcceptPolicy = .always
    sessionConfiguration.httpShouldSetCookies = true
    sessionConfiguration.timeoutIntervalForRequest = 30
    self.session = URLSession(configuration: sessionConfiguration)

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    self.decoder = decoder
  }

  func send<T: Decodable>(_ request: APIRequest, responseType: T.Type) async throws -> T {
    let (data, response) = try await rawSend(request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIError.invalidResponse
    }

    guard (200..<300).contains(httpResponse.statusCode) else {
      if httpResponse.statusCode == 401 { throw APIError.unauthorized }
      let message = String(data: data, encoding: .utf8) ?? ""
      throw APIError.message(message.isEmpty ? "请求失败，状态码：\(httpResponse.statusCode)" : message)
    }

    do {
      return try decoder.decode(T.self, from: data)
    } catch {
      throw APIError.decodingFailed
    }
  }

  func send(_ request: APIRequest) async throws {
    let (_, response) = try await rawSend(request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIError.invalidResponse
    }
    guard (200..<300).contains(httpResponse.statusCode) else {
      if httpResponse.statusCode == 401 { throw APIError.unauthorized }
      throw APIError.message("请求失败，状态码：\(httpResponse.statusCode)")
    }
  }

  private func rawSend(_ request: APIRequest) async throws -> (Data, URLResponse) {
    let url = url(for: request.path)
    var urlRequest = URLRequest(url: url)
    urlRequest.httpMethod = request.method.rawValue
    urlRequest.httpShouldHandleCookies = true
    urlRequest.httpBody = request.body

    var headers = request.headers
    if headers["Content-Type"] == nil, request.body != nil {
      headers["Content-Type"] = "application/json"
    }
    if headers["Accept"] == nil {
      headers["Accept"] = "application/json"
    }
    urlRequest.allHTTPHeaderFields = headers

    return try await session.data(for: urlRequest)
  }

  private func url(for path: String) -> URL {
    let trimmed = path.trimmingCharacters(in: CharacterSet(charactersIn: "/"))
    guard !trimmed.isEmpty else { return configuration.apiBaseURL }
    return configuration.apiBaseURL.appendingPathComponent(trimmed)
  }
}
