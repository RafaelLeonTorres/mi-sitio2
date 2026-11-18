var builder = WebApplication.CreateBuilder(args);

// Requests without a valid token are rejected here, before they
// reach any service.
builder.Services.AddAuthentication().AddJwtBearer(options =>
{
    options.Authority = "https://identity.tienda.example";
    options.Audience = "store-api";
});
builder.Services.AddAuthorization();

// Routes, their policies and the services behind them live in
// appsettings.json: /api/orders/{**rest} goes to http://orders.
builder.Services.AddReverseProxy()
    .LoadFromConfig(builder.Configuration.GetSection("ReverseProxy"));

var app = builder.Build();
app.UseAuthentication();
app.UseAuthorization();
app.MapReverseProxy();
app.Run();
