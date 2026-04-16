import SwiftUI

struct AssetDetailView: View {
    @EnvironmentObject var harness: HarnessService
    let asset: Asset
    @State private var selectedTimeframe = "1D"
    @Environment(\.dismiss) private var dismiss

    let timeframes = ["1H", "1D", "1W", "1M", "1Y"]

    var body: some View {
        ScrollView {
            VStack(spacing: 20) {
                // Price Section
                VStack(spacing: 8) {
                    Text(asset.name)
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Text(asset.formattedPrice)
                        .font(.system(size: 42, weight: .bold))

                    HStack(spacing: 6) {
                        Image(systemName: asset.isPositive ? "arrow.up.right" : "arrow.down.right")
                        Text(String(format: "%+$%.2f (%@)", asset.change, asset.formattedChange))
                        Text("Today")
                            .foregroundStyle(.secondary)
                    }
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(asset.isPositive ? .green : .red)
                }
                .padding(.top)

                // Chart
                VStack(spacing: 16) {
                    ChartView(isPositive: asset.isPositive)
                        .frame(height: 200)
                        .padding(.horizontal)

                    // Timeframe Selector
                    HStack(spacing: 8) {
                        ForEach(timeframes, id: \.self) { tf in
                            Button {
                                selectedTimeframe = tf
                            } label: {
                                Text(tf)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .padding(.horizontal, 16)
                                    .padding(.vertical, 8)
                                    .background(selectedTimeframe == tf ? Color("Accent").opacity(0.2) : Color("Surface"))
                                    .foregroundStyle(selectedTimeframe == tf ? Color("Accent") : .secondary)
                                    .clipShape(Capsule())
                            }
                        }
                    }
                }

                // Stats Grid
                LazyVGrid(columns: [GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible()), GridItem(.flexible())], spacing: 12) {
                    StatItem(label: "Open", value: String(format: "$%.2f", asset.price - asset.change))
                    StatItem(label: "High", value: String(format: "$%.2f", asset.price * 1.02))
                    StatItem(label: "Low", value: String(format: "$%.2f", asset.price * 0.98))
                    StatItem(label: "Volume", value: "12.4M")
                }
                .padding(.horizontal)

                // AI Analysis
                VStack(alignment: .leading, spacing: 12) {
                    HStack {
                        Image(systemName: "cube.fill")
                            .foregroundStyle(Color("Accent"))
                        Text("AI Analysis")
                            .fontWeight(.semibold)
                    }

                    VStack(alignment: .leading, spacing: 12) {
                        Text("Based on current market conditions and technical indicators, \(asset.symbol) shows \(asset.isPositive ? "bullish momentum with strong support levels. Consider entry points on minor pullbacks." : "bearish pressure with resistance at current levels. Monitor for potential reversal signals.")")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)

                        Divider()

                        HStack {
                            Circle()
                                .fill(asset.isPositive ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text(asset.isPositive ? "BULLISH" : "BEARISH")
                                .font(.caption)
                                .fontWeight(.bold)
                                .foregroundStyle(asset.isPositive ? .green : .red)
                        }
                    }
                    .padding()
                    .background(Color("Surface"))
                    .clipShape(RoundedRectangle(cornerRadius: 16))
                }
                .padding(.horizontal)

                // Quick Actions
                HStack(spacing: 12) {
                    ActionButton(icon: "chart.bar.xaxis", title: "Analyze", color: Color("Accent")) {
                        Task {
                            _ = await harness.sendCommand("analyze \(asset.symbol)")
                        }
                    }
                    ActionButton(icon: "bell.fill", title: "Alert", color: .orange) {
                        Task {
                            _ = await harness.sendCommand("alert \(asset.symbol)")
                        }
                    }
                    ActionButton(icon: "arrow.left.arrow.right", title: "Compare", color: .purple) {
                        Task {
                            _ = await harness.sendCommand("compare \(asset.symbol)")
                        }
                    }
                }
                .padding(.horizontal)

                Spacer(minLength: 100)
            }
        }
        .background(Color("Background"))
        .navigationTitle(asset.symbol)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItem(placement: .principal) {
                VStack(spacing: 0) {
                    Text(asset.symbol)
                        .font(.headline)
                    Text(asset.exchange.uppercased())
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .safeAreaInset(edge: .bottom) {
            // Trade Buttons
            HStack(spacing: 12) {
                Button {
                    Task {
                        _ = await harness.sendCommand("sell \(asset.symbol) 1 share")
                    }
                } label: {
                    Text("Sell")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.red.opacity(0.15))
                        .foregroundStyle(.red)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                        .overlay(
                            RoundedRectangle(cornerRadius: 12)
                                .strokeBorder(Color.red.opacity(0.3), lineWidth: 1)
                        )
                }

                Button {
                    Task {
                        _ = await harness.sendCommand("buy \(asset.symbol) 1 share")
                    }
                } label: {
                    Text("Buy")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color.green)
                        .foregroundStyle(.white)
                        .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding()
            .background(.ultraThinMaterial)
        }
    }
}

struct ChartView: View {
    let isPositive: Bool

    var body: some View {
        GeometryReader { geo in
            Path { path in
                let points = generateChartPoints(width: geo.size.width, height: geo.size.height)
                guard let first = points.first else { return }
                path.move(to: first)
                for point in points.dropFirst() {
                    path.addLine(to: point)
                }
            }
            .stroke(isPositive ? Color.green : Color.red, lineWidth: 2)
        }
    }

    func generateChartPoints(width: CGFloat, height: CGFloat) -> [CGPoint] {
        let count = 50
        var y = height / 2
        return (0..<count).map { i in
            let x = CGFloat(i) / CGFloat(count - 1) * width
            let trend: CGFloat = isPositive ? -0.15 : 0.15
            y = max(20, min(height - 20, y + CGFloat.random(in: -10...10) + trend * 3))
            return CGPoint(x: x, y: y)
        }
    }
}

struct StatItem: View {
    let label: String
    let value: String

    var body: some View {
        VStack(spacing: 4) {
            Text(label)
                .font(.caption2)
                .foregroundStyle(.secondary)
            Text(value)
                .font(.caption)
                .fontWeight(.semibold)
        }
    }
}

struct ActionButton: View {
    let icon: String
    let title: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: 8) {
                Image(systemName: icon)
                    .foregroundStyle(color)
                Text(title)
                    .font(.caption)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .background(Color("Surface"))
            .clipShape(RoundedRectangle(cornerRadius: 12))
        }
        .buttonStyle(.plain)
    }
}

#Preview {
    NavigationStack {
        AssetDetailView(asset: Asset(id: "1", symbol: "AAPL", name: "Apple Inc.", price: 175.50, change: 2.35, changePercent: 1.36, exchange: "stocks"))
            .environmentObject(HarnessService())
    }
}
