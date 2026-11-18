var builder = WebApplication.CreateBuilder(args);

// One DbContext for every module: one database, one transaction.
var connection = builder.Configuration.GetConnectionString("Store");
builder.Services.AddDbContext<StoreDbContext>(
    options => options.UseSqlServer(connection));

// Each module registers its own services; Program.cs only adds them.
builder.Services.AddCatalogModule();
builder.Services.AddOrdersModule();

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks().AddDbContextCheck<StoreDbContext>();

var app = builder.Build();
app.UseExceptionHandler();
app.MapCatalogEndpoints();
app.MapOrdersEndpoints();
app.MapHealthChecks("/health");
app.Run();
