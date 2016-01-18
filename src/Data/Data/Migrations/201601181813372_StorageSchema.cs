namespace Sistrategia.Overmind.Data.Migrations
{
    using System;
    using System.Data.Entity.Migrations;
    
    public partial class StorageSchema : DbMigration
    {
        public override void Up()
        {
            CreateTable(
                "dbo.cloud_storage_account",
                c => new
                    {
                        cloud_storage_account_id = c.Int(nullable: false, identity: true),
                        cloud_storage_provider_id = c.String(maxLength: 128),
                        public_key = c.Guid(nullable: false),
                        provider_key = c.String(nullable: false, maxLength: 128),
                        account_name = c.String(maxLength: 512),
                        account_key = c.String(maxLength: 1024),
                        alias = c.String(maxLength: 256),
                        description = c.String(),
                    })
                .PrimaryKey(t => t.cloud_storage_account_id)
                .ForeignKey("dbo.cloud_storage_provider", t => t.cloud_storage_provider_id)
                .Index(t => t.cloud_storage_provider_id)
                .Index(t => t.public_key);
            
            CreateTable(
                "dbo.cloud_storage_provider",
                c => new
                    {
                        cloud_storage_provider_id = c.String(nullable: false, maxLength: 128),
                        name = c.String(maxLength: 512),
                        description = c.String(),
                    })
                .PrimaryKey(t => t.cloud_storage_provider_id);
            
            CreateTable(
                "dbo.security_user_cloud_storage_account",
                c => new
                    {
                        user_id = c.Int(nullable: false),
                        cloud_storage_account_id = c.Int(nullable: false),
                    })
                .PrimaryKey(t => new { t.user_id, t.cloud_storage_account_id })
                .ForeignKey("dbo.security_user", t => t.user_id, cascadeDelete: true)
                .ForeignKey("dbo.cloud_storage_account", t => t.cloud_storage_account_id, cascadeDelete: true)
                .Index(t => t.user_id)
                .Index(t => t.cloud_storage_account_id);
            
        }
        
        public override void Down()
        {
            DropForeignKey("dbo.security_user_cloud_storage_account", "cloud_storage_account_id", "dbo.cloud_storage_account");
            DropForeignKey("dbo.security_user_cloud_storage_account", "user_id", "dbo.security_user");
            DropForeignKey("dbo.cloud_storage_account", "cloud_storage_provider_id", "dbo.cloud_storage_provider");
            DropIndex("dbo.security_user_cloud_storage_account", new[] { "cloud_storage_account_id" });
            DropIndex("dbo.security_user_cloud_storage_account", new[] { "user_id" });
            DropIndex("dbo.cloud_storage_account", new[] { "public_key" });
            DropIndex("dbo.cloud_storage_account", new[] { "cloud_storage_provider_id" });
            DropTable("dbo.security_user_cloud_storage_account");
            DropTable("dbo.cloud_storage_provider");
            DropTable("dbo.cloud_storage_account");
        }
    }
}
