using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;

namespace Challenges;

/// <summary>
/// Revisa en el código lo que el resultado no alcanza a ver: que un Singleton use <c>Lazy&lt;T&gt;</c>
/// y tenga el constructor privado, o que una solución no use LINQ.
/// </summary>
public static class CodeRules
{
    public static RuleOutcome Check(CodeRule rule, CSharpCompilation compilation, SyntaxTree code)
    {
        var passed = rule.Kind switch
        {
            "uses-type" => Uses(compilation, code, rule.Type),
            "avoids-type" => !Uses(compilation, code, rule.Type),
            "private-constructor" => HasOnlyPrivateConstructors(compilation, code, rule.Type),
            _ => false,
        };
        return new RuleOutcome(rule.Kind, rule.Type, passed);
    }

    /// <summary>Si el código nombra el tipo o usa alguno de sus miembros, incluidos sus métodos de extensión.</summary>
    private static bool Uses(CSharpCompilation compilation, SyntaxTree code, string metadataName)
    {
        var target = compilation.GetTypeByMetadataName(metadataName);
        if (target is null)
            return false;
        var model = compilation.GetSemanticModel(code);
        foreach (var node in code.GetRoot().DescendantNodes())
        {
            var used = node switch
            {
                SelectOrGroupClauseSyntax clause => Refers(model.GetSymbolInfo(clause).Symbol, target),
                QueryClauseSyntax clause => Refers(model.GetQueryClauseInfo(clause).OperationInfo.Symbol, target),
                ExpressionSyntax expression => Refers(model.GetSymbolInfo(expression).Symbol, target)
                    || Is(model.GetTypeInfo(expression).Type, target),
                _ => false,
            };
            if (used)
                return true;
        }
        return false;
    }

    private static bool Refers(ISymbol? symbol, INamedTypeSymbol target) =>
        symbol switch
        {
            ITypeSymbol type => Is(type, target),
            IMethodSymbol method => Is(method.ContainingType, target) || Is(method.ReducedFrom?.ContainingType, target),
            IPropertySymbol property => Is(property.ContainingType, target),
            IFieldSymbol field => Is(field.ContainingType, target),
            _ => false,
        };

    private static bool Is(ITypeSymbol? type, INamedTypeSymbol target) =>
        type is not null && SymbolEqualityComparer.Default.Equals(type.OriginalDefinition, target);

    /// <summary>Si el tipo del visitante solo tiene constructores privados, escritos por él.</summary>
    private static bool HasOnlyPrivateConstructors(CSharpCompilation compilation, SyntaxTree code, string name)
    {
        var model = compilation.GetSemanticModel(code);
        var type = code.GetRoot()
            .DescendantNodes()
            .OfType<TypeDeclarationSyntax>()
            .Where(declaration => declaration.Identifier.ValueText == name)
            .Select(declaration => model.GetDeclaredSymbol(declaration))
            .OfType<INamedTypeSymbol>()
            .FirstOrDefault();
        if (type is null)
            return false;
        var constructors = type.InstanceConstructors;
        return constructors.Length > 0
            && constructors.All(constructor =>
                !constructor.IsImplicitlyDeclared && constructor.DeclaredAccessibility == Accessibility.Private
            );
    }
}
