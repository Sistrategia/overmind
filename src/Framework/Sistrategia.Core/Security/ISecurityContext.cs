/*************************************************************************************************************
* ISecurityContext.cs is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

using System.Security.Principal;

namespace Sistrategia.Security;

public interface ISecurityContext
{
    IPrincipal CurrentPrincipal { get; }
    //UserInfo GetUserInfo(string publicKey);
    UserInfo GetCurrentUserInfo();
    UserInfo GetSystemUserInfo();
    string GetCurrentUserId();

    string GetCurrentUserName();
    string GetCurrentUserEmail();
}

//public interface ISecurityContext : ISecurityContext<string>
//{

//}

//public interface ISecurityContext<TKey>
//{
//    IPrincipal CurrentPrincipal { get; }
//    UserInfo GetUserInfo(TKey publicKey);
//    UserInfo GetCurrentUserInfo();
//    UserInfo GetSystemUserInfo();
//    TKey GetCurrentUserId();
//}