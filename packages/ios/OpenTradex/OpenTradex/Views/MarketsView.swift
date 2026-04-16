import SwiftUI

struct MarketsView: View {
    @EnvironmentObject var harness: HarnessService
    @State private var selectedExchange = "all"

    let exchanges = [
        ("all", "All", "square.grid.2x2"),
        ("stocks", "Stocks", "chart.line.uptrend.xyaxis"),
        ("crypto", "Crypto", "bitcoinsign.circle"),
        ("commodities", "Commodities", "cube")
    ]

    var filteredAssets: [Asset] {
        if selectedExchange == "all" {
            return harness.watchlist
        }
        return harness.watchlist.filter { $0.exchange == selectedExchange }
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Exchange Filter
                    ScrollView(.horizontal, showsIndicators: false) {
                        HStack(spacing: 8) {
                            ForEach(exchanges, id: \.0) { exchange in
                                Button {
                                    selectedExchange = exchange.0
                                } label: {
                                    HStack(spacing: 6) {
                                        Image(systemName: exchange.2)
                                            .font(.caption)
                                        Text(exchange.1)
                                            .font(.caption)
                                            .fontWeight(.semibold)
                                    }
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 10)
                                    .background(selectedExchange == exchange.0 ? Color("Accent").opacity(0.15) : Color("Surface"))
                                    .foregroundStyle(selectedExchange == exchange.0 ? Color("Accent") : .primary)
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(selectedExchange == exchange.0 ? Color("Accent").opacity(0.4) : Color.clear, lineWidth: 1)
                                    )
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }

                    // Stats
                    HStack(spacing: 12) {
                        StatCard(value: "\(filteredAssets.count)", label: "Assets")
                        StatCard(value: "\(filteredAssets.filter { $0.changePercent > 0 }.count)", label: "Gainers", color: .green)
                        StatCard(value: "\(filteredAssets.filter { $0.changePercent < 0 }.count)", label: "Losers", color: .red)
                    }
                    .padding(.horizontal)

                    // Top Movers (only show for "all")
                    if selectedExchange == "all" {
                        VStack(alignment: .leading, spacing: 12) {
                            HStack {
                                Image(systemName: "flame.fill")
                                    .foregroundStyle(.orange)
                                Text("Top Movers")
                                    .fontWeight(.semibold)
                            }
                            .padding(.horizontal)

                            ScrollView(.horizontal, showsIndicators: false) {
                                HStack(spacing: 12) {
                                    ForEach(harness.trending.prefix(5)) { asset in
                                        NavigationLink(destination: AssetDetailView(asset: asset)) {
                                            MoverCard(asset: asset)
                                        }
                                        .buttonStyle(.plain)
                                    }
                                }
                                .padding(.horizontal)
                            }
                        }
                    }

                    // Asset List
                    VStack(alignment: .leading, spacing: 12) {
                        HStack {
                            Image(systemName: "list.bullet")
                                .foregroundStyle(Color("Accent"))
                            Text(selectedExchange == "all" ? "All Markets" : exchanges.first { $0.0 == selectedExchange }?.1 ?? "")
                                .fontWeight(.semibold)
                        }
                        .padding(.horizontal)

                        LazyVStack(spacing: 8) {
                            ForEach(filteredAssets) { asset in
                                NavigationLink(destination: AssetDetailView(asset: asset)) {
                                    AssetRow(asset: asset)
                                }
                                .buttonStyle(.plain)
                            }
                        }
                        .padding(.horizontal)
                    }
                }
                .padding(.bottom, 20)
            }
            .background(Color("Background"))
            .navigationTitle("Markets")
            .refreshable {
                await harness.refresh()
            }
        }
    }
}

struct StatCard: View {
    let value: String
    let label: String
    var color: Color = .primary

    var body: some View {
        VStack(spacing: 4) {
            Text(value)
                .font(.title2)
                .fontWeight(.bold)
                .foregroundStyle(color)
            Text(label.uppercased())
                .font(.caption2)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct MoverCard: View {
    let asset: Asset

    var body: some View {
        VStack(spacing: 8) {
            ZStack {
                Circle()
                    .fill(Color("Surface2"))
                    .frame(width: 36, height: 36)
                Text(String(asset.symbol.prefix(2)))
                    .font(.caption2)
                    .fontWeight(.bold)
                    .foregroundStyle(Color("Accent"))
            }

            Text(asset.symbol)
                .font(.caption)
                .fontWeight(.semibold)

            Text(asset.formattedChange)
                .font(.caption2)
                .fontWeight(.medium)
                .foregroundStyle(asset.isPositive ? .green : .red)
        }
        .padding(12)
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    MarketsView()
        .environmentObject(HarnessService())
}
