import SwiftUI

@main
struct GoldenBridgeMobileApp: App {
  @StateObject private var appState = AppState()

  var body: some Scene {
    WindowGroup {
      ContentView()
        .environmentObject(appState)
        .task {
          await appState.bootstrapIfNeeded()
        }
    }
  }
}
