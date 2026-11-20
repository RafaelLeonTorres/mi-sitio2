using System.Diagnostics;
using System.Reflection;

namespace Challenges;

public static class Errors
{
    /// <summary>
    /// Una excepción del código del visitante: su tipo, su mensaje, el método de su código donde
    /// ocurrió y, si hay símbolos de depuración (fuera del navegador), la línea.
    /// </summary>
    /// <param name="code">El ensamblado compilado del visitante, para reconocer sus métodos en la pila.</param>
    public static RuntimeError Describe(Exception error, Assembly? code)
    {
        int? line = null;
        string? member = null;
        try
        {
            // El primer marco de su ensamblado es el más interno: donde ocurrió, aunque lo haya
            // llamado el código que revisa el reto.
            foreach (var frame in new StackTrace(error, fNeedFileInfo: true).GetFrames())
            {
                var method = frame.GetMethod();
                if (method is null || code is null || method.Module.Assembly != code)
                    continue;
                member = Name(method);
                if (frame.GetFileName() == CodeCompiler.CodeSource && frame.GetFileLineNumber() > 0)
                    line = frame.GetFileLineNumber();
                break;
            }
        }
        catch (Exception)
        {
            // Sin información de la pila no hay método ni línea, y no es un error.
        }
        // En el navegador, una excepción que lanza el runtime (NullReferenceException,
        // IndexOutOfRangeException) no trae ese marco en la pila, pero sí en TargetSite.
        if (member is null && error.TargetSite is { } site && code is not null && site.Module.Assembly == code)
            member = Name(site);
        return new RuntimeError(error.GetType().Name, error.Message, line, member);
    }

    /// <summary>
    /// El método como lo escribió el visitante: una lambda (<c>&lt;Suma&gt;b__0_0</c>) o un método
    /// asíncrono (<c>&lt;Suma&gt;d__0.MoveNext</c>) se reportan como el método que los contiene.
    /// </summary>
    private static string Name(MethodBase method)
    {
        var type = method.DeclaringType;
        var name = method.Name;
        if (type is not null && type.Name.StartsWith('<') && name == "MoveNext")
        {
            name = Inside(type.Name);
            type = type.DeclaringType;
        }
        else if (name.StartsWith('<'))
        {
            name = Inside(name);
        }
        while (type is not null && type.Name.StartsWith('<'))
            type = type.DeclaringType;
        return type is null ? name : $"{type.Name}.{name}";
    }

    private static string Inside(string generated)
    {
        var end = generated.IndexOf('>', StringComparison.Ordinal);
        return end > 1 ? generated[1..end] : generated;
    }
}
