import SwiftUI

struct PortfolioView: View {
    @EnvironmentObject var harness: HarnessService
    @State private var selectedTimeframe = "1D"

    let timeframes = ["1H", "1D", "1W", "1M", "1Y"]

    // Mock positions
    let positions = [
        (symbol: "SPY", name: "S&P 500", quantity: 10.0, avgPrice: 590.0, currentPrice: 600.54, pnl: 105.40, pnlPercent: 1.79),
        (symbol: "NVDA", name: "NVIDIA", quantity: 5.0, avgPrice: 180.0, currentPrice: 199.37, pnl: 96.85, pnlPercent: 10.76),
        (symbol: "BTC", name: "Bitcoin", quantity: 0.5, avgPrice: 70000.0, currentPrice: 74550.32, pnl: 2275.16, pnlPercent: 6.50)
    ]

    var totalValue: Double {
        positions.reduce(0) { $0 + $1.quantity * $1.currentPrice }
    }

    var totalPnL: Double {
        positions.reduce(0) { $0 + $1.pnl }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Total Value Card
                    VStack(spacing: 12) {
                        Text("Total Portfolio Value")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Text(String(format: "$%.2f", totalValue + harness.portfolio.cash))
                            .font(.system(size: 36, weight: .bold))

                        HStack(spacing: 6) {
                            Image(systemName: totalPnL >= 0 ? "arrow.up.right" : "arrow.down.right")
                            Text(String(format: "%+$%.2f today", totalPnL))
                        }
                        .font(.subheadline)
                        .fontWeight(.semibold)
                        .foregroundStyle(totalPnL >= 0 ? .green : .red)

                        // Timeframe Selector
                        HStack(spacing: 0) {
                            ForEach(timeframes, id: \.self) { tf in
                                Button {
                                    selectedTimeframe = tf
                                } label: {
                                    Text(tf)
                                        .font(.caption)
                                        .fontWeight(.semibold)
                                        .foregroundStyle(selectedTimeframe == tf ? .primary : .secondary)
                                        .padding(.vertical, 8)
                                        .frame(maxWidth: .infinity)
                                        .background(selectedTimeframe == tf ? Color("Surface2") : Color.clear)
                                        .clipShape(RoundedRectangle(cornerRadius: 8))
                                }
                            }
                        }
                        .padding(4)
                        .background(Color("Background"))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                    }
                    .padding(20)
                    .background(Color("Surface"))
                    .clipShape(RoundedRectangle(cornerRadius: 20))
                    .padding(.horizontal)

                    // Summary Cards
                    HStack(spacing: 12) {
                        PortfolioCard(
                            title: "Cash",
                            value: harness.portfolio.cash,
                            subtitle: "\(String(format: "%.1f", harness.portfolio.apy))% APY"
                        )
                        PortfolioCard(
                            title: "Invested",
                            value: totalValue,
                            change: (totalPnL / totalValue) * 100,
                            subtitle: "Today"
                        )
                    }
                    .padding(.horizontal)

                    // Positions Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "layers.fill")
                                .foregroundStyle(Color("Accent"))
                            Text("Positions")
                                .fontWeight(.semibold)
                            Spacer()
                            Text("\(positions.count)")
                                .font(.caption)
                                .padding(.horizontal, 8)
                                .padding(.vertical, 2)
                                .background(Color("Surface2"))
                                .clipShape(Capsule())
                        }
                        .padding(.horizontal)

                        LazyVStack(spacing: 8) {
                            ForEach(positions, id: \.symbol) { position in
                                PositionRow(
                                    symbol: position.symbol,
                                    name: position.name,
                                    quantity: position.quantity,
                                    currentPrice: position.currentPrice,
                                    pnl: position.pnl,
                                    pnlPercent: position.pnlPercent
                                )
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Activity Section
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "clock.fill")
                                .foregroundStyle(.orange)
                            Text("Recent Activity")
                                .fontWeight(.semibold)
                        }
                        .padding(.horizontal)

                        VStack(spacing: 16) {
                            Image(systemName: "doc.text")
                                .font(.title)
                                .foregroundStyle(Color("Surface2"))
                            Text("No recent trades")
                                .foregroundStyle(.secondary)
                            Text("Paper trades will appear here")
                                .font(.caption)
                                .foregroundStyle(.tertiary)
                        }
                        .frame(maxWidth: .infinity)
                        .padding(32)
                        .background(Color("Surface"))
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }
                }
                .padding(.vertical, 20)
            }
            .background(Color("Background"))
            .navigationTitle("Portfolio")
            .refreshable {
                await harness.refresh()
            }
        }
    }
}

struct PositionRow: View {
    let symbol: String
    let name: String
    let quantity: Double
    let currentPrice: Double
    let pnl: Double
    let pnlPercent: Double

    var body: some View {
        HStack(spacing: 12) {
            ZStack {
                Circle()
                    .fill(Color("Surface2"))
                    .frame(width: 40, height: 40)
                Text(String(symbol.prefix(2)))
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Color("Accent"))
            }

            VStack(alignment: .leading, spacing: 2) {
                Text(symbol)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text("\(String(format: "%.2f", quantity)) shares")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            VStack(alignment: .trailing, spacing: 2) {
                Text(String(format: "$%.2f", quantity * currentPrice))
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(String(format: "%+$%.2f (%.2f%%)", pnl, pnlPercent))
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(pnl >= 0 ? .green : .red)
            }
        }
        .padding(14)
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    PortfolioView()
        .environmentObject(HarnessService())
}
