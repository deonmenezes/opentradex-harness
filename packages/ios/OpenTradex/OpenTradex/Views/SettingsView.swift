import SwiftUI

struct SettingsView: View {
    @EnvironmentObject var harness: HarnessService
    @State private var apiURL = "http://localhost:3210/api"
    @State private var notifications = true
    @State private var haptics = true
    @State private var showingPanicAlert = false

    var body: some View {
        NavigationStack {
            List {
                // Status Section
                Section {
                    VStack(alignment: .leading, spacing: 8) {
                        HStack {
                            Circle()
                                .fill(harness.status.isConnected ? Color.green : Color.red)
                                .frame(width: 8, height: 8)
                            Text("Harness Status")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)
                        }

                        Text(harness.status.isConnected ? "Connected" : "Disconnected")
                            .font(.title2)
                            .fontWeight(.bold)

                        Text("Mode: \(harness.status.mode)")
                            .font(.caption)
                            .foregroundStyle(Color("Accent"))
                    }
                    .listRowBackground(Color("Surface"))
                }

                // Connection Section
                Section("Connection") {
                    HStack {
                        TextField("API URL", text: $apiURL)
                            .textFieldStyle(.plain)
                            .autocapitalization(.none)
                            .autocorrectionDisabled()

                        Button("Apply") {
                            harness.setBaseURL(apiURL)
                        }
                        .buttonStyle(.borderedProminent)
                        .tint(Color("Accent"))
                    }
                    .listRowBackground(Color("Surface"))
                }

                // Preferences Section
                Section("Preferences") {
                    Toggle(isOn: $notifications) {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Push Notifications")
                                Text("Trade alerts and market updates")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "bell.fill")
                                .foregroundStyle(Color("Accent"))
                        }
                    }
                    .tint(Color("Accent"))
                    .listRowBackground(Color("Surface"))

                    Toggle(isOn: $haptics) {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Haptic Feedback")
                                Text("Vibrate on interactions")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "iphone.radiowaves.left.and.right")
                                .foregroundStyle(Color("Accent"))
                        }
                    }
                    .tint(Color("Accent"))
                    .listRowBackground(Color("Surface"))
                }

                // Trading Section
                Section("Trading") {
                    NavigationLink {
                        Text("Risk Settings")
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Risk Settings")
                                Text("Position limits and stop-loss rules")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "shield.checkered")
                                .foregroundStyle(.green)
                        }
                    }
                    .listRowBackground(Color("Surface"))

                    NavigationLink {
                        Text("Connected Accounts")
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Connected Accounts")
                                Text("Manage broker connections")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "wallet.pass.fill")
                                .foregroundStyle(.orange)
                        }
                    }
                    .listRowBackground(Color("Surface"))

                    NavigationLink {
                        Text("Trading History")
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Trading History")
                                Text("View past trades and performance")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "chart.bar.fill")
                                .foregroundStyle(.purple)
                        }
                    }
                    .listRowBackground(Color("Surface"))
                }

                // AI Harness Section
                Section("AI Harness") {
                    NavigationLink {
                        Text("Agent Configuration")
                    } label: {
                        Label("Agent Configuration", systemImage: "cube.fill")
                    }
                    .listRowBackground(Color("Surface"))

                    NavigationLink {
                        Text("Debug Console")
                    } label: {
                        Label("Debug Console", systemImage: "terminal.fill")
                    }
                    .listRowBackground(Color("Surface"))

                    HStack {
                        Label("Auto-Loop", systemImage: "arrow.triangle.2.circlepath")
                        Spacer()
                        Text("Cycles: \(harness.status.cycles)")
                            .font(.caption)
                            .foregroundStyle(.secondary)
                        Text(harness.status.isAutoLoop ? "Active" : "Paused")
                            .font(.caption)
                            .padding(.horizontal, 8)
                            .padding(.vertical, 2)
                            .background(harness.status.isAutoLoop ? Color.green.opacity(0.2) : Color.secondary.opacity(0.2))
                            .clipShape(Capsule())
                    }
                    .listRowBackground(Color("Surface"))
                }

                // Danger Zone
                Section {
                    Button(role: .destructive) {
                        showingPanicAlert = true
                    } label: {
                        Label {
                            VStack(alignment: .leading) {
                                Text("Emergency Stop")
                                    .foregroundStyle(.red)
                                Text("Close all positions immediately")
                                    .font(.caption)
                                    .foregroundStyle(.secondary)
                            }
                        } icon: {
                            Image(systemName: "exclamationmark.triangle.fill")
                                .foregroundStyle(.red)
                        }
                    }
                    .listRowBackground(Color("Surface"))
                } header: {
                    Text("Danger Zone")
                        .foregroundStyle(.red)
                }

                // Footer
                Section {
                    VStack(spacing: 4) {
                        Text("OpenTradex iOS v1.0.0")
                            .font(.caption)
                        Text("AI-Powered Trading Harness")
                            .font(.caption2)
                            .foregroundStyle(.secondary)
                    }
                    .frame(maxWidth: .infinity)
                    .listRowBackground(Color.clear)
                }
            }
            .scrollContentBackground(.hidden)
            .background(Color("Background"))
            .navigationTitle("Settings")
            .alert("Emergency Stop", isPresented: $showingPanicAlert) {
                Button("Cancel", role: .cancel) { }
                Button("PANIC STOP", role: .destructive) {
                    Task {
                        await harness.panic()
                    }
                }
            } message: {
                Text("This will immediately close all positions and halt trading. Continue?")
            }
        }
    }
}

#Preview {
    SettingsView()
        .environmentObject(HarnessService())
}
