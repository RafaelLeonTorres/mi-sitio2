var builder = WebApplication.CreateBuilder(args);

builder.Services.AddProblemDetails(options =>
    options.CustomizeProblemDetails = problem =>
    {
        var request = problem.HttpContext.Request;
        problem.ProblemDetails.Instance =
            $"{request.Method} {request.Path}";
    });
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();
builder.Services.AddValidation();
builder.AddJwtAuthentication();
builder.AddRateLimiting();
builder.Services.AddScoped<ProductService>();

var app = builder.Build();

// Order matters: each one only sees what the ones before let through.
app.UseExceptionHandler();
// Empty 401, 403, 404 and 429 responses become Problem Details.
app.UseStatusCodePages();
app.UseMiddleware<CorrelationIdMiddleware>();
app.UseRouting();
app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

var products = app.MapGroup("/api/products");
// ... the endpoints of each operation
app.Run();
