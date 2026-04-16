import SwiftUI

struct CommandView: View {
    @EnvironmentObject var harness: HarnessService
    @State private var inputText = ""
    @State private var messages: [Message] = [
        Message(role: .system, content: "AI Harness Command Interface ready. Send commands to control trading operations, scan markets, and manage your portfolio.", timestamp: Date())
    ]
    @State private var isLoading = false
    @FocusState private var isInputFocused: Bool

    let quickCommands = [
        ("Audit", "Audit the workspace and tell me what is missing."),
        ("Scan", "Scan all markets and find the top 3 opportunities."),
        ("Status", "Show current harness status and connected feeds."),
        ("Risk", "Display current risk metrics and exposure.")
    ]

    var body: some View {
        NavigationStack {
            VStack(spacing: 0) {
                // Status Bar
                HStack {
                    StatusBadge(status: harness.status)
                    Spacer()
                }
                .padding()
                .background(Color("Surface"))

                // Quick Commands
                ScrollView(.horizontal, showsIndicators: false) {
                    HStack(spacing: 8) {
                        ForEach(quickCommands, id: \.0) { cmd in
                            Button {
                                inputText = cmd.1
                            } label: {
                                Text(cmd.0)
                                    .font(.caption)
                                    .fontWeight(.semibold)
                                    .foregroundStyle(Color("Accent"))
                                    .padding(.horizontal, 14)
                                    .padding(.vertical, 8)
                                    .background(Color("Surface"))
                                    .clipShape(Capsule())
                                    .overlay(
                                        Capsule()
                                            .strokeBorder(Color("Border"), lineWidth: 1)
                                    )
                            }
                        }
                    }
                    .padding(.horizontal)
                    .padding(.vertical, 10)
                }
                .background(Color("Surface").opacity(0.5))

                // Messages
                ScrollViewReader { proxy in
                    ScrollView {
                        LazyVStack(spacing: 12) {
                            ForEach(messages) { message in
                                MessageBubble(message: message)
                                    .id(message.id)
                            }

                            if isLoading {
                                LoadingBubble()
                            }
                        }
                        .padding()
                    }
                    .onChange(of: messages.count) { _, _ in
                        withAnimation {
                            proxy.scrollTo(messages.last?.id, anchor: .bottom)
                        }
                    }
                }

                // Input Area
                HStack(spacing: 8) {
                    TextField("Enter command...", text: $inputText, axis: .vertical)
                        .textFieldStyle(.plain)
                        .padding(12)
                        .background(Color("Surface"))
                        .clipShape(RoundedRectangle(cornerRadius: 22))
                        .overlay(
                            RoundedRectangle(cornerRadius: 22)
                                .strokeBorder(Color("Border"), lineWidth: 1)
                        )
                        .focused($isInputFocused)
                        .lineLimit(1...5)
                        .onSubmit { sendMessage() }

                    Button {
                        sendMessage()
                    } label: {
                        Image(systemName: "paperplane.fill")
                            .foregroundStyle(inputText.isEmpty || isLoading ? .secondary : Color("Background"))
                            .padding(12)
                            .background(inputText.isEmpty || isLoading ? Color("Surface2") : Color("Accent"))
                            .clipShape(Circle())
                    }
                    .disabled(inputText.isEmpty || isLoading)
                }
                .padding()
                .background(Color("Surface").opacity(0.8))
            }
            .background(Color("Background"))
            .navigationTitle("Command")
            .navigationBarTitleDisplayMode(.inline)
        }
    }

    func sendMessage() {
        guard !inputText.isEmpty, !isLoading else { return }

        let userMessage = Message(role: .user, content: inputText, timestamp: Date())
        messages.append(userMessage)

        let command = inputText
        inputText = ""
        isLoading = true

        Task {
            let response = await harness.sendCommand(command)
            let assistantMessage = Message(role: .assistant, content: response, timestamp: Date())
            messages.append(assistantMessage)
            isLoading = false
        }
    }
}

struct MessageBubble: View {
    let message: Message

    var body: some View {
        HStack {
            if message.role == .user { Spacer() }

            if message.role != .user {
                ZStack {
                    Circle()
                        .fill(Color("Surface"))
                        .frame(width: 28, height: 28)
                    Image(systemName: message.role == .system ? "info.circle" : "cube")
                        .font(.caption)
                        .foregroundStyle(Color("Accent"))
                }
            }

            Text(message.content)
                .font(.subheadline)
                .padding(12)
                .background(backgroundColor)
                .foregroundStyle(foregroundColor)
                .clipShape(RoundedRectangle(cornerRadius: 16))

            if message.role != .user { Spacer() }
        }
    }

    var backgroundColor: Color {
        switch message.role {
        case .user: return Color("Accent")
        case .assistant: return Color("Surface")
        case .system: return Color("Surface").opacity(0.5)
        }
    }

    var foregroundColor: Color {
        switch message.role {
        case .user: return Color("Background")
        case .assistant: return .primary
        case .system: return .secondary
        }
    }
}

struct LoadingBubble: View {
    @State private var dotCount = 0
    let timer = Timer.publish(every: 0.3, on: .main, in: .common).autoconnect()

    var body: some View {
        HStack {
            ZStack {
                Circle()
                    .fill(Color("Surface"))
                    .frame(width: 28, height: 28)
                Image(systemName: "cube")
                    .font(.caption)
                    .foregroundStyle(Color("Accent"))
            }

            HStack(spacing: 4) {
                ForEach(0..<3) { i in
                    Circle()
                        .fill(Color("Accent"))
                        .frame(width: 6, height: 6)
                        .opacity(i <= dotCount ? 1 : 0.3)
                }
            }
            .padding(12)
            .background(Color("Surface"))
            .clipShape(RoundedRectangle(cornerRadius: 16))

            Spacer()
        }
        .onReceive(timer) { _ in
            dotCount = (dotCount + 1) % 3
        }
    }
}

#Preview {
    CommandView()
        .environmentObject(HarnessService())
}
