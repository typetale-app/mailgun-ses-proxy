"use client"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Database, Globe, Info, Save, Settings } from "lucide-react"

interface Setting {
    key: string
    label: string
    type: string
    value: string
    source: "database" | "environment"
}

export default function SettingsPage() {
    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
                    <p className="text-muted-foreground">Manage application configuration and behavior overrides.</p>
                </div>
                <Button disabled={true} className="md:w-auto w-full">
                    <Save className="mr-2 h-4 w-4" />
                    Save Changes
                </Button>
            </div>

            <div className="grid gap-8 lg:grid-cols-3">
                <div className="lg:col-span-2 space-y-6">
                    <Card className="border-muted/50">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings className="h-5 w-5 text-primary" />
                                Application Configuration
                            </CardTitle>
                            <CardDescription>
                                These values override environment variables when stored in the database.
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="text-muted-foreground space-y-0 divide-y border rounded-lg overflow-hidden bg-card/50 p-8 mx-4 mb-4">
                            <span className="italic">Coming soon...</span>
                        </CardContent>
                    </Card>
                </div>

                <div className="space-y-6">
                    <Card className="border-muted/50 bg-primary/5">
                        <CardHeader>
                            <CardTitle className="text-sm flex items-center gap-2">
                                <Info className="h-4 w-4 text-primary" />
                                Configuration Sources
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs space-y-4 text-muted-foreground leading-relaxed">
                            <div className="flex gap-3">
                                <Database className="h-4 w-4 text-primary shrink-0" />
                                <div>
                                    <span className="font-bold text-foreground">Database (DB)</span>
                                    <p>
                                        Overrides environment variables. These values are permanent across deployments.
                                    </p>
                                </div>
                            </div>
                            <div className="flex gap-3">
                                <Globe className="h-4 w-4 text-blue-500 shrink-0" />
                                <div>
                                    <span className="font-bold text-foreground">Environment (ENV)</span>
                                    <p>
                                        Read from system environment or .env file. Saving a change promotes it to the
                                        Database.
                                    </p>
                                </div>
                            </div>
                            <div className="p-3 bg-card border rounded-md italic">
                                Note: Some security-critical settings may require a server restart to take full effect.
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    )
}
