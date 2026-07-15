/*************************************************************************************************************
* ISecurityUser.cs is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

namespace Sistrategia.Security;

public interface ISecurityUser
{
    public string? LoginName { get; set; }
    public string? ThumbnailUrl { get; set; }
    public string? PasswordHash { get; set; }
}
