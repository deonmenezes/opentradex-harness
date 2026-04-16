import SwiftUI

struct HomeView: View {
    @EnvironmentObject var harness: HarnessService
    @State private var selectedTab = 0
    @State private var searchText = ""

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    // Status Badge
                    StatusBadge(status: harness.status)
                        .padding(.top, 8)

                    // Portfolio Summary
                    HStack(spacing: 12) {
                        PortfolioCard(
                            title: "Cash",
                            value: harness.portfolio.cash,
                            subtitle: "\(String(format: "%.1f", harness.portfolio.apy))% APY"
                        )
                        PortfolioCard(
                            title: "Investments",
                            value: harness.portfolio.investments,
                            change: harness.portfolio.dayPnLPercent,
                            subtitle: "Today"
                        )
                    }
                    .padding(.horizontal)

                    // Tab Selector
                    Picker("View", selection: $selectedTab) {
                        Text("Watchlist").tag(0)
                        Text("Trending").tag(1)
                        Text("News").tag(2)
                    }
                    .pickerStyle(.segmented)
                    .padding(.horizontal)

                    // Content
                    switch selectedTab {
                    case 0:
                        WatchlistSection(assets: filteredAssets)
                    case 1:
                        TrendingSection(assets: harness.trending)
                    case 2:
                        NewsSection(news: harness.news)
                    default:
                        EmptyView()
                    }
                }
                .padding(.bottom, 20)
            }
            .background(Color("Background"))
            .navigationTitle("OpenTradex")
            .navigationBarTitleDisplayMode(.inline)
            .searchable(text: $searchText, prompt: "Search markets...")
            .refreshable {
                await harness.refresh()
            }
        }
    }

    var filteredAssets: [Asset] {
        if searchText.isEmpty {
            return harness.watchlist
        }
        return harness.watchlist.filter {
            $0.symbol.localizedCaseInsensitiveContains(searchText) ||
            $0.name.localizedCaseInsensitiveContains(searchText)
        }
    }
}

struct StatusBadge: View {
    let status: HarnessStatus

    var body: some View {
        HStack(spacing: 8) {
            Circle()
                .fill(status.isConnected ? Color.green : Color.red)
                .frame(width: 6, height: 6)
            Text(status.isConnected ? "CONNECTED" : "OFFLINE")
                .font(.caption2)
                .fontWeight(.semibold)

            Divider()
                .frame(height: 10)

            Text(status.mode.uppercased())
                .font(.caption2)
                .fontWeight(.semibold)
                .foregroundStyle(Color("Accent"))
        }
        .padding(.horizontal, 12)
        .padding(.vertical, 6)
        .background(Color("Surface"))
        .clipShape(Capsule())
    }
}

struct PortfolioCard: View {
    let title: String
    let value: Double
    var change: Double? = nil
    let subtitle: String

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            Text(title.uppercased())
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(String(format: "$%.2f", value))
                .font(.title2)
                .fontWeight(.bold)

            HStack {
                Text(subtitle)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                if let change = change {
                    Text(String(format: "%+.2f%%", change))
                        .font(.caption)
                        .fontWeight(.semibold)
                        .foregroundStyle(change >= 0 ? .green : .red)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 16))
    }
}

struct WatchlistSection: View {
    let assets: [Asset]

    var body: some View {
        LazyVStack(spacing: 8) {
            ForEach(assets) { asset in
                NavigationLink(destination: AssetDetailView(asset: asset)) {
                    AssetRow(asset: asset)
                }
                .buttonStyle(.plain)
            }
        }
        .padding(.horizontal)
    }
}

struct TrendingSection: View {
    let assets: [Asset]

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Image(systemName: "flame.fill")
                    .foregroundStyle(.orange)
                Text("Top Movers")
                    .fontWeight(.semibold)
            }
            .padding(.horizontal)

            LazyVStack(spacing: 8) {
                ForEach(assets) { asset in
                    NavigationLink(destination: AssetDetailView(asset: asset)) {
                        AssetRow(asset: asset)
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal)
        }
    }
}

struct NewsSection: View {
    let news: [NewsItem]

    var body: some View {
        LazyVStack(spacing: 8) {
            ForEach(news) { item in
                NewsRow(item: item)
            }
        }
        .padding(.horizontal)
    }
}

struct AssetRow: View {
    let asset: Asset

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            ZStack {
                Circle()
                    .fill(Color("Surface2"))
                    .frame(width: 40, height: 40)
                Text(String(asset.symbol.prefix(2)))
                    .font(.caption)
                    .fontWeight(.bold)
                    .foregroundStyle(Color("Accent"))
            }

            // Name
            VStack(alignment: .leading, spacing: 2) {
                Text(asset.symbol)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(asset.name)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            // Sparkline placeholder
            SparklineView(isPositive: asset.isPositive)
                .frame(width: 60, height: 24)

            // Price
            VStack(alignment: .trailing, spacing: 2) {
                Text(asset.formattedPrice)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                Text(asset.formattedChange)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundStyle(asset.isPositive ? .green : .red)
            }
        }
        .padding(14)
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

struct SparklineView: View {
    let isPositive: Bool

    var body: some View {
        GeometryReader { geo in
            Path { path in
                let points = generatePoints(width: geo.size.width, height: geo.size.height)
                guard let first = points.first else { return }
                path.move(to: first)
                for point in points.dropFirst() {
                    path.addLine(to: point)
                }
            }
            .stroke(isPositive ? Color.green : Color.red, lineWidth: 1.5)
        }
    }

    func generatePoints(width: CGFloat, height: CGFloat) -> [CGPoint] {
        let count = 20
        var y = height / 2
        return (0..<count).map { i in
            let x = CGFloat(i) / CGFloat(count - 1) * width
            let trend: CGFloat = isPositive ? -0.1 : 0.1
            y = max(4, min(height - 4, y + CGFloat.random(in: -8...8) + trend * 5))
            return CGPoint(x: x, y: y)
        }
    }
}

struct NewsRow: View {
    let item: NewsItem

    var body: some View {
        HStack(alignment: .top, spacing: 12) {
            ZStack {
                RoundedRectangle(cornerRadius: 10)
                    .fill(Color("Surface2"))
                    .frame(width: 44, height: 44)
                Image(systemName: item.icon)
                    .foregroundStyle(Color("Accent"))
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(item.title)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .lineLimit(2)

                Text(item.summary)
                    .font(.caption)
                    .foregroundStyle(.secondary)
                    .lineLimit(2)

                HStack {
                    Text(item.source.uppercased())
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color("Accent"))

                    Circle()
                        .fill(.secondary)
                        .frame(width: 3, height: 3)

                    Text(item.timeAgo)
                        .font(.caption2)
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding(14)
        .background(Color("Surface"))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

#Preview {
    HomeView()
        .environmentObject(HarnessService())
}
