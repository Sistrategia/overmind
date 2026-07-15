using System.Diagnostics;
using System.Diagnostics.CodeAnalysis;
using System.Runtime.CompilerServices;

namespace Sistrategia.ExceptionExtensions;

public static class ArgumentExceptionExtensions
{
    /// <summary>Throws an exception if <paramref name="argument"/> is null or empty.</summary>
    /// <param name="argument">The string argument to validate as non-null and non-empty.</param>
    /// <param name="paramName">The name of the parameter with which <paramref name="argument"/> corresponds.</param>
    /// <exception cref="ArgumentNullException"><paramref name="argument"/> is null.</exception>
    /// <exception cref="ArgumentException"><paramref name="argument"/> is empty.</exception>
    [DebuggerHidden]
    [StackTraceHidden]
    [MethodImpl(MethodImplOptions.AggressiveInlining)]
    public static void ThrowIfNullOrEmpty([NotNull] string? argument, [CallerArgumentExpression("argument")] string? paramName = null) {
        if (string.IsNullOrEmpty(argument)) {
            //ThrowNullOrEmptyException(argument, paramName);
            throw (argument is null ?
                new ArgumentNullException(paramName) :
                new ArgumentException("The value cannot be an empty string.", paramName));
        }
    }

    //[DoesNotReturn]
    //private static void ThrowNullOrEmptyException(string? argument, string? paramName) =>
    //        throw (argument is null ?
    //            new ArgumentNullException(paramName) :
    //            new ArgumentException("The value cannot be an empty string.", paramName));
}
