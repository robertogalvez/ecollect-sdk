// swift-tools-version: 5.9
import PackageDescription

let package = Package(
    name: "EcollectSDK",
    platforms: [.iOS(.v14), .macOS(.v12)],
    products: [
        .library(name: "EcollectSDK", targets: ["EcollectSDK"])
    ],
    targets: [
        .target(
            name: "EcollectSDK",
            dependencies: []
        ),
        .testTarget(
            name: "EcollectSDKTests",
            dependencies: ["EcollectSDK"]
        )
    ]
)
