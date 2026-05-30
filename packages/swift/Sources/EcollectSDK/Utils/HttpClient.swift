import Foundation

/// Lightweight HTTP client built on URLSession with async/await.
/// Handles JSON encoding/decoding, error mapping, and exponential backoff retries.
final class HttpClient {
    private let baseURL: String
    private let session: URLSession

    init(baseURL: String, session: URLSession = .shared) {
        self.baseURL = baseURL
        self.session = session
    }

    // MARK: - POST with retry

    /// Performs a POST request, decodes the response, and maps ecollect error codes.
    /// On FAIL_SYSTEM the request is retried up to 3 times with exponential backoff.
    func post<RequestBody: Encodable, ResponseBody: Decodable>(
        endpoint: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        return try await postWithRetry(endpoint: endpoint, body: body, attempt: 0)
    }

    /// POST to an absolute URL (used for production GetTransactionInformation).
    func postAbsolute<RequestBody: Encodable, ResponseBody: Decodable>(
        url: String,
        body: RequestBody
    ) async throws -> ResponseBody {
        return try await postURLWithRetry(urlString: url, body: body, attempt: 0)
    }

    // MARK: - Private helpers

    private func postWithRetry<Req: Encodable, Res: Decodable>(
        endpoint: String,
        body: Req,
        attempt: Int
    ) async throws -> Res {
        let urlString = baseURL + endpoint
        return try await postURLWithRetry(urlString: urlString, body: body, attempt: attempt)
    }

    private func postURLWithRetry<Req: Encodable, Res: Decodable>(
        urlString: String,
        body: Req,
        attempt: Int
    ) async throws -> Res {
        do {
            return try await performPost(urlString: urlString, body: body)
        } catch EcollectError.networkRetryable(let msg) where attempt < 3 {
            let delay = UInt64(pow(2.0, Double(attempt))) * 1_000_000_000
            try await Task.sleep(nanoseconds: delay)
            return try await postURLWithRetry(urlString: urlString, body: body, attempt: attempt + 1)
        }
    }

    private func performPost<Req: Encodable, Res: Decodable>(
        urlString: String,
        body: Req
    ) async throws -> Res {
        guard let url = URL(string: urlString) else {
            throw EcollectError.invalidConfig("Invalid URL: \(urlString)")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.setValue("application/json", forHTTPHeaderField: "Accept")

        let encoder = JSONEncoder()
        encoder.outputFormatting = .prettyPrinted
        request.httpBody = try encoder.encode(body)

        let (data, response) = try await session.data(for: request)

        guard let httpResponse = response as? HTTPURLResponse else {
            throw EcollectError.networkRetryable("Invalid HTTP response")
        }

        guard (200...299).contains(httpResponse.statusCode) else {
            throw EcollectError.networkRetryable("HTTP \(httpResponse.statusCode)")
        }

        let decoder = JSONDecoder()
        return try decoder.decode(Res.self, from: data)
    }
}
