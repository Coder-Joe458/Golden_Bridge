import XCTest
@testable import GoldenBridgeMobile

final class GoldenBridgeMobileTests: XCTestCase {
  func testAppConfigurationDefaults() throws {
    let configuration = AppConfiguration.shared
    XCTAssert(configuration.apiBaseURL.absoluteString.contains("aibridgeloan"))
  }
}
