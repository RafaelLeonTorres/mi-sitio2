// Demo only: there's no password, the role comes in the request.
app.MapPost("/api/auth/token",
        (TokenRequest request, TokenService tokens) =>
            TypedResults.Ok(tokens.Issue(request.Role)))
    .AllowAnonymous();

public sealed record TokenRequest(
    [Required, AllowedValues("Reader", "Editor", "Admin")] string Role);

public sealed class TokenService(IConfiguration configuration)
{
    public TokenResponse Issue(string role)
    {
        var key = new SymmetricSecurityKey(
            Convert.FromBase64String(configuration["Jwt:Key"]!));
        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = "https://tienda.example",
            Audience = "tienda-api",
            Subject = new ClaimsIdentity(
            [
                new Claim("sub", $"demo-{role.ToLowerInvariant()}"),
                new Claim("role", role),
            ]),
            Expires = DateTime.UtcNow.AddMinutes(5),
            SigningCredentials = new(key, SecurityAlgorithms.HmacSha256),
        };
        var token = new JsonWebTokenHandler().CreateToken(descriptor);
        return new TokenResponse(token, "Bearer", 300);
    }
}
