internal sealed class ProductRepository(StoreDbContext db)
    : IProductRepository
{
    public async Task<IReadOnlyList<Product>> GetByIdsAsync(
        IEnumerable<int> ids, CancellationToken ct) =>
        await db.Products
            .Where(product => ids.Contains(product.Id))
            .ToListAsync(ct);
}

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(
        this IServiceCollection services, IConfiguration configuration)
    {
        var connection = configuration.GetConnectionString("Store");
        services.AddDbContext<StoreDbContext>(
            options => options.UseSqlServer(connection));
        services.AddScoped<IProductRepository, ProductRepository>();
        services.AddScoped<IOrderRepository, OrderRepository>();
        services.AddScoped<IUnitOfWork>(
            provider => provider.GetRequiredService<StoreDbContext>());
        return services;
    }
}
