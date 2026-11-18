public static class Authentication
{
    public static void AddJwtAuthentication(
        this WebApplicationBuilder builder)
    {
        var key = new SymmetricSecurityKey(
            Convert.FromBase64String(builder.Configuration["Jwt:Key"]!));

        builder.Services.AddAuthentication().AddJwtBearer(options =>
            options.TokenValidationParameters = new()
            {
                ValidIssuer = "https://tienda.example",
                ValidAudience = "tienda-api",
                IssuerSigningKey = key,
                // Expired means expired: no five minutes of grace.
                ClockSkew = TimeSpan.Zero,
            });

        builder.Services.AddAuthorizationBuilder()
            .AddPolicy("Catalog", p => p.RequireRole("Editor", "Admin"))
            .AddPolicy("Admin", p => p.RequireRole("Admin"));
    }
}
