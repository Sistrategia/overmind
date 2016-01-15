using System;
using System.ComponentModel.DataAnnotations;
using Sistrategia.Overmind.Resources;

namespace Sistrategia.Overmind.WebApp.Models
{
    public class LoginViewModel
    {
        [Required]
        [Display(ResourceType = typeof(LocalizedStrings), Name = "Email")]
        [EmailAddress]
        public string Email { get; set; }

        [Required]
        [DataType(DataType.Password)]
        [Display(ResourceType = typeof(LocalizedStrings), Name = "Password")]
        public string Password { get; set; }

        //[Display(Name = "Remember me?")]
        [Display(ResourceType = typeof(LocalizedStrings), Name = "Account_RememberMe")]
        public bool RememberMe { get; set; }
    }
}