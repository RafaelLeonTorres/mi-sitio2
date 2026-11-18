// Orders calls Catalog over HTTP with a typed client.
public sealed class CatalogClient(HttpClient http)
{
    public async Task<IReadOnlyList<PriceDto>> GetPricesAsync(
        IEnumerable<int> ids, CancellationToken ct)
    {
        var query = string.Join("&", ids.Select(id => $"ids={id}"));
        var prices = await http.GetFromJsonAsync<List<PriceDto>>(
            $"/api/products/prices?{query}", ct);
        return prices ?? [];
    }
}

// Program.cs in Orders: timeouts, retries and a circuit breaker,
// because the network fails in ways a method call never does.
builder.Services
    .AddHttpClient<CatalogClient>(
        client => client.BaseAddress = new Uri("http://catalog"))
    .AddStandardResilienceHandler();
