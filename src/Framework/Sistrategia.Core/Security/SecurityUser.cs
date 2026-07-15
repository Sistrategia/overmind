/*************************************************************************************************************
* SecurityUser.cs is part of the Sistrategia.Security Framework developed by Sistrategia
* Copyright (c) Sistrategia. All rights reserved.
* Licensed under the Apache License, Version 2.0. See LICENSE.txt in the project root for license information.
* 
* Contributor(s):	J. Ernesto Ocampo Cicero, ernesto@sistrategia.com
* Last Update:		2022-Jan-04
* Created:			2010-Sep-08
* Version:			6.0.6829.0
*************************************************************************************************************/

//using Sistrategia.Contacts;
using Sistrategia.Contacts;

namespace Sistrategia.Security;

//public class SecurityUser : ISecurityUser // : Person, ISecurityUser
//{
//    public SecurityUser()
//        : base() {
//        PrimaryUserRole = "Guest";
//        //UserRoles = new List<string>();
//    }

//    public string? PublicKey { get; set; }
//    public string? LoginName { get; set; }
//    public string? DisplayName { get; set; }
//    //public string? FullName { get; set; }
//    public string? EmailAddress { get; set; }
//    public string? ThumbnailUrl { get; set; }

//    public string? PasswordHash { get; set; }
//    ////public string PasswordFormat { get; }
//    //public string? SecurityStamp { get; set; }

//    public string PrimaryUserRole { get; set; }
//    //public IEnumerable<string> UserRoles { get; set; }
//}

public class SecurityUser : Person, ISecurityUser
{
    public SecurityUser()
          : base() {
        PrimaryUserRole = "Guest";
        SecurityStamp = Guid.NewGuid().ToString();
        //UserRoles = new List<string>();
    }

    public string? LoginName { get; set; }
    //public string? EmailAddress { get; set; }
    public string? PasswordHash { get; set; }

    // public int? PasswordFormat { get; set; }
    public string? PasswordSalt { get; set; }
    // public string? PasswordQuestion { get; set; }
    // public string? PasswordAnswer { get; set; }

    public string? SecurityStamp { get; set; }

    public string PrimaryUserRole { get; set; }
    //public IEnumerable<string> UserRoles { get; set; }

    public bool EmailConfirmed { get; set; } = true; // false;

    // IUserLockoutStore properties
    public DateTimeOffset? LockoutEnd { get; set; }
    public bool LockoutEnabled { get; set; }
    public int AccessFailedCount { get; set; }

    /// <summary>
    /// Timestamp of the user's last successful login (573-T002).
    /// </summary>
    public DateTime? LastLoginAt { get; set; }

    public string? StudentId { get; set; }
    public int? GraduationYear { get; set; }
    public string? DegreeShortName { get; set; }

    // , ap.[student_id]
    // , ug.[graduation_year]
    // , dg.[short_name] AS [degree_short_name]

    public UserInfo AsUserInfo() {
        return new UserInfo {
            PublicKey = this.PublicKey,
            DisplayName = this.DisplayName,
            EmailAddress = this.EmailAddress,
            ThumbnailUrl = this.ThumbnailUrl
        };
    }
}
