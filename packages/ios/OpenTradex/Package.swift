// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "OpenTradex",
    platforms: [
        .iOS(.v17),
        .macOS(.v14)
    ],
    products: [
        .library(
            name: "OpenTradex",
            targets: ["OpenTradex"]
        ),
    ],
    targets: [
        .target(
            name: "OpenTradex",
            path: "OpenTradex"
        ),
    ]
)
