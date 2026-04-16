import Foundation

struct Asset: Identifiable, Codable {
    let id: String
    let symbol: String
    let name: String
    var price: Double
    var change: Double
    var changePercent: Double
    let exchange: String
    var sparkline: [Double]?

    var isPositive: Bool {
        change >= 0
    }

    var formattedPrice: String {
        if price >= 1000 {
            return String(format: "$%.2f", price)
        } else if price >= 1 {
            return String(format: "$%.2f", price)
        } else if price >= 0.01 {
            return String(format: "$%.4f", price)
        } else {
            return String(format: "$%.8f", price)
        }
    }

    var formattedChange: String {
        let sign = change >= 0 ? "+" : ""
        return "\(sign)\(String(format: "%.2f", changePercent))%"
    }
}

struct HarnessStatus: Codable {
    let mode: String
    let connection: String
    let isAutoLoop: Bool
    let cycles: Int

    var isConnected: Bool {
        connection == "connected"
    }
}

struct PortfolioSummary {
    var cash: Double = 0
    var investments: Double = 0
    var totalValue: Double { cash + investments }
    var dayPnL: Double = 0
    var dayPnLPercent: Double = 0
    var apy: Double = 2.9
}

struct NewsItem: Identifiable {
    let id: String
    let title: String
    let summary: String
    let source: String
    let timestamp: Date
    let icon: String

    var timeAgo: String {
        let seconds = Int(Date().timeIntervalSince(timestamp))
        if seconds < 60 { return "Just now" }
        if seconds < 3600 { return "\(seconds / 60)m ago" }
        if seconds < 86400 { return "\(seconds / 3600)h ago" }
        return "\(seconds / 86400)d ago"
    }
}

struct Message: Identifiable {
    let id = UUID()
    let role: MessageRole
    let content: String
    let timestamp: Date

    enum MessageRole {
        case user, assistant, system
    }
}
