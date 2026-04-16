import Foundation
import Combine

@MainActor
class HarnessService: ObservableObject {
    @Published var status = HarnessStatus(mode: "paper-only", connection: "disconnected", isAutoLoop: false, cycles: 0)
    @Published var watchlist: [Asset] = []
    @Published var trending: [Asset] = []
    @Published var news: [NewsItem] = []
    @Published var portfolio = PortfolioSummary()
    @Published var isLoading = false

    private var baseURL = "http://localhost:3210/api"
    private var webSocketTask: URLSessionWebSocketTask?
    private var cancellables = Set<AnyCancellable>()

    init() {
        loadMockData()
        Task {
            await connect()
        }
    }

    private func loadMockData() {
        watchlist = [
            Asset(id: "1", symbol: "SPY", name: "S&P 500", price: 600.54, change: 6.21, changePercent: 0.89, exchange: "stocks"),
            Asset(id: "2", symbol: "NVDA", name: "NVIDIA", price: 199.37, change: 3.42, changePercent: 1.74, exchange: "stocks"),
            Asset(id: "3", symbol: "GOLD", name: "Gold", price: 4790.27, change: 4.31, changePercent: 0.09, exchange: "commodities"),
            Asset(id: "4", symbol: "BTC", name: "Bitcoin", price: 74550.32, change: 680.45, changePercent: 0.92, exchange: "crypto"),
            Asset(id: "5", symbol: "AAPL", name: "Apple", price: 265.93, change: 7.15, changePercent: 2.76, exchange: "stocks"),
            Asset(id: "6", symbol: "GOOGL", name: "Google", price: 337.50, change: 5.48, changePercent: 1.65, exchange: "stocks"),
            Asset(id: "7", symbol: "MSFT", name: "Microsoft", price: 417.88, change: 21.89, changePercent: 5.53, exchange: "stocks"),
            Asset(id: "8", symbol: "TSLA", name: "Tesla", price: 397.52, change: 31.07, changePercent: 8.48, exchange: "stocks"),
        ]

        trending = [
            Asset(id: "11", symbol: "LDO", name: "Lido", price: 0.39, change: 0.038, changePercent: 10.78, exchange: "crypto"),
            Asset(id: "12", symbol: "DOT", name: "Polkadot", price: 1.27, change: 0.118, changePercent: 10.22, exchange: "crypto"),
            Asset(id: "13", symbol: "HIMS", name: "HIMS", price: 26.53, change: 2.24, changePercent: 9.22, exchange: "stocks"),
            Asset(id: "14", symbol: "HOOD", name: "Robinhood", price: 89.65, change: 6.61, changePercent: 7.96, exchange: "stocks"),
        ]

        news = [
            NewsItem(id: "1", title: "US Jobs Data Boosts Market Sentiment", summary: "Strong US job figures have reassured investors.", source: "reuters", timestamp: Date().addingTimeInterval(-3600), icon: "chart.bar"),
            NewsItem(id: "2", title: "Fed Chair Hints at Rate Pause", summary: "The Federal Reserve may pause rate hikes.", source: "bloomberg", timestamp: Date().addingTimeInterval(-7200), icon: "building.columns"),
            NewsItem(id: "3", title: "Crypto Market Reacts to News", summary: "Regulatory developments spark fluctuations.", source: "coindesk", timestamp: Date().addingTimeInterval(-10800), icon: "bitcoinsign.circle"),
        ]
    }

    func connect() async {
        isLoading = true
        defer { isLoading = false }

        do {
            let health = try await fetchHealth()
            status = health
            connectWebSocket()
        } catch {
            print("Connection failed: \(error)")
            status = HarnessStatus(mode: "paper-only", connection: "disconnected", isAutoLoop: false, cycles: 0)
        }
    }

    private func fetchHealth() async throws -> HarnessStatus {
        guard let url = URL(string: "\(baseURL)/health") else {
            throw URLError(.badURL)
        }

        let (data, _) = try await URLSession.shared.data(from: url)
        return try JSONDecoder().decode(HarnessStatus.self, from: data)
    }

    func sendCommand(_ command: String) async -> String {
        guard let url = URL(string: "\(baseURL)/command") else {
            return "Error: Invalid URL"
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")

        let body = ["command": command]
        request.httpBody = try? JSONEncoder().encode(body)

        do {
            let (data, _) = try await URLSession.shared.data(for: request)
            if let response = try? JSONDecoder().decode([String: String].self, from: data),
               let result = response["response"] {
                return result
            }
            return "Command sent successfully"
        } catch {
            return "Error: \(error.localizedDescription)"
        }
    }

    func panic() async {
        guard let url = URL(string: "\(baseURL)/panic") else { return }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"

        _ = try? await URLSession.shared.data(for: request)
    }

    func setBaseURL(_ url: String) {
        baseURL = url
        Task {
            await connect()
        }
    }

    private func connectWebSocket() {
        let wsURL = baseURL.replacingOccurrences(of: "http", with: "ws")
            .replacingOccurrences(of: "/api", with: "/ws")

        guard let url = URL(string: wsURL) else { return }

        webSocketTask?.cancel()
        webSocketTask = URLSession.shared.webSocketTask(with: url)
        webSocketTask?.resume()

        receiveMessage()
    }

    private func receiveMessage() {
        webSocketTask?.receive { [weak self] result in
            switch result {
            case .success(let message):
                if case .string(let text) = message {
                    self?.handleWebSocketMessage(text)
                }
                self?.receiveMessage()
            case .failure(let error):
                print("WebSocket error: \(error)")
                Task { @MainActor in
                    self?.status = HarnessStatus(mode: self?.status.mode ?? "paper-only",
                                                  connection: "disconnected",
                                                  isAutoLoop: self?.status.isAutoLoop ?? false,
                                                  cycles: self?.status.cycles ?? 0)
                }
            }
        }
    }

    private func handleWebSocketMessage(_ text: String) {
        // Handle real-time updates
        print("WS Message: \(text)")
    }

    func refresh() async {
        await connect()
    }
}
