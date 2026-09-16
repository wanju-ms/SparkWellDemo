// swift-tools-version: 6.0
import PackageDescription

let package = Package(
    name: "TodoClient",
    platforms: [.iOS(.v17), .macOS(.v14)],
    products: [.library(name: "TodoClient", targets: ["TodoClient"])],
    targets: [
        .target(name: "TodoClient"),
        .testTarget(name: "TodoClientTests", dependencies: ["TodoClient"]),
    ]
)