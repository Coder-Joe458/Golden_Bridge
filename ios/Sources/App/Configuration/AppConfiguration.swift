import Foundation

struct AppConfiguration {
  let apiBaseURL: URL
  let authBaseURL: URL

  static let shared: AppConfiguration = {
    let infoDictionary = Bundle.main.infoDictionary
    let environment = ProcessInfo.processInfo.environment

    let apiBase = environment["API_BASE_URL"]
      ?? infoDictionary?["API_BASE_URL"] as? String
      ?? "https://www.aibridgeloan.com"
    let authBase = environment["AUTH_BASE_URL"]
      ?? infoDictionary?["AUTH_BASE_URL"] as? String
      ?? "https://www.aibridgeloan.com"

    return AppConfiguration(
      apiBaseURL: AppConfiguration.normalize(urlString: apiBase),
      authBaseURL: AppConfiguration.normalize(urlString: authBase)
    )
  }()

  private static func normalize(urlString: String) -> URL {
    guard var components = URLComponents(string: urlString) else {
      fatalError("Invalid URL string: \(urlString)")
    }
    if components.path.isEmpty {
      components.path = "/"
    }
    guard let url = components.url else {
      fatalError("Invalid URL components: \(urlString)")
    }
    return url
  }
}
