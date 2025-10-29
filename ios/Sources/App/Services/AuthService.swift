import Foundation

struct CSRFResponse: Codable {
  let csrfToken: String
}

final class AuthService {
  private let apiClient: APIClient
  private let configuration: AppConfiguration
  private let decoder: JSONDecoder
  private let session: URLSession

  init(apiClient: APIClient, configuration: AppConfiguration) {
    self.apiClient = apiClient
    self.configuration = configuration

    let config = URLSessionConfiguration.default
    config.requestCachePolicy = .reloadIgnoringLocalCacheData
    config.httpCookieAcceptPolicy = .always
    config.httpShouldSetCookies = true
    config.timeoutIntervalForRequest = 30
    self.session = URLSession(configuration: config)

    let decoder = JSONDecoder()
    decoder.dateDecodingStrategy = .iso8601
    self.decoder = decoder
  }

  private func fetchCSRFToken() async throws -> String {
    let url = configuration.authBaseURL.appendingPathComponent("api/auth/csrf")
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.httpShouldHandleCookies = true
    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse, (200..<300).contains(httpResponse.statusCode) else {
      throw APIError.invalidResponse
    }
    let csrf = try decoder.decode(CSRFResponse.self, from: data)
    return csrf.csrfToken
  }

  @MainActor
  func fetchSession() async throws -> UserSession? {
    let url = configuration.authBaseURL.appendingPathComponent("api/auth/session")
    var request = URLRequest(url: url)
    request.httpMethod = "GET"
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.httpShouldHandleCookies = true

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else {
      throw APIError.invalidResponse
    }

    if httpResponse.statusCode == 200 {
      if data == Data("null".utf8) { return nil }
      return try decoder.decode(UserSession.self, from: data)
    }

    if httpResponse.statusCode == 401 {
      return nil
    }

    throw APIError.message("无法刷新登录状态（\(httpResponse.statusCode)）")
  }

  @MainActor
  func signIn(identifier: String, password: String) async throws -> UserSession {
    let csrf = try await fetchCSRFToken()
    let url = configuration.authBaseURL.appendingPathComponent("api/auth/callback/credentials")

    var components = URLComponents()
    components.queryItems = [
      URLQueryItem(name: "csrfToken", value: csrf),
      URLQueryItem(name: "identifier", value: identifier),
      URLQueryItem(name: "password", value: password),
      URLQueryItem(name: "json", value: "true")
    ]

    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.httpBody = components.percentEncodedQuery?.data(using: .utf8)
    request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
    request.setValue("application/json", forHTTPHeaderField: "Accept")
    request.httpShouldHandleCookies = true

    let (data, response) = try await session.data(for: request)
    guard let httpResponse = response as? HTTPURLResponse else { throw APIError.invalidResponse }

    if httpResponse.statusCode == 401 {
      throw APIError.unauthorized
    }

    guard (200..<300).contains(httpResponse.statusCode) else {
      let message = String(data: data, encoding: .utf8) ?? ""
      throw APIError.message(message.isEmpty ? "登录失败" : message)
    }

    return try decoder.decode(UserSession.self, from: data)
  }

  func signOut() async {
    do {
      let csrf = try await fetchCSRFToken()
      let url = configuration.authBaseURL.appendingPathComponent("api/auth/signout")
      var request = URLRequest(url: url)
      request.httpMethod = "POST"
      request.setValue("application/x-www-form-urlencoded", forHTTPHeaderField: "Content-Type")
      request.httpShouldHandleCookies = true

      var components = URLComponents()
      components.queryItems = [
        URLQueryItem(name: "csrfToken", value: csrf),
        URLQueryItem(name: "json", value: "true"),
        URLQueryItem(name: "redirect", value: "false")
      ]
      request.httpBody = components.percentEncodedQuery?.data(using: .utf8)

      _ = try await session.data(for: request)
    } catch {
      // ignore sign out failures, cookie will eventually expire
    }
  }
}
