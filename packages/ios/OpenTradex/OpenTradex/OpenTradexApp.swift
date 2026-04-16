import SwiftUI

@main
struct OpenTradexApp: App {
    @StateObject private var harnessService = HarnessService()

    var body: some Scene {
        WindowGroup {
            ContentView()
                .environmentObject(harnessService)
                .preferredColorScheme(.dark)
        }
    }
}
