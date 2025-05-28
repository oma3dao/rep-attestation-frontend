import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, FileCheck, LinkIcon, Star, Plus } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  // Mock data for demonstration
  const recentAttestations = [
    {
      id: "1",
      type: "certification",
      subject: "DeFi Protocol v2.1",
      status: "confirmed",
      date: "2024-01-15",
      icon: Shield,
      color: "bg-blue-100 text-blue-800",
    },
    {
      id: "2",
      type: "user-review",
      subject: "Gaming App",
      status: "pending",
      date: "2024-01-14",
      icon: Star,
      color: "bg-yellow-100 text-yellow-800",
    },
    {
      id: "3",
      type: "endorsement",
      subject: "NFT Marketplace",
      status: "confirmed",
      date: "2024-01-13",
      icon: FileCheck,
      color: "bg-green-100 text-green-800",
    },
  ]

  const stats = [
    { label: "Total Attestations", value: "12", change: "+3 this month" },
    { label: "Confirmed", value: "9", change: "+2 this month" },
    { label: "Pending", value: "3", change: "+1 this week" },
    { label: "Reputation Score", value: "847", change: "+15 this month" },
  ]

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600 mt-2">Manage your attestations and view your activity</p>
        </div>
        <Link href="/attest">
          <Button className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create Attestation</span>
          </Button>
        </Link>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <Card key={index}>
            <CardHeader className="pb-2">
              <CardDescription className="text-sm">{stat.label}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-gray-900">{stat.value}</div>
              <p className="text-sm text-green-600 mt-1">{stat.change}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Recent Attestations */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Attestations</CardTitle>
              <CardDescription>Your latest attestation submissions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {recentAttestations.map((attestation) => (
                  <div key={attestation.id} className="flex items-center justify-between p-4 border rounded-lg">
                    <div className="flex items-center space-x-4">
                      <div className="p-2 bg-gray-100 rounded-lg">
                        <attestation.icon className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{attestation.subject}</h3>
                        <p className="text-sm text-gray-500 capitalize">{attestation.type.replace("-", " ")}</p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-3">
                      <Badge
                        variant={attestation.status === "confirmed" ? "default" : "secondary"}
                        className={
                          attestation.status === "confirmed"
                            ? "bg-green-100 text-green-800"
                            : "bg-yellow-100 text-yellow-800"
                        }
                      >
                        {attestation.status}
                      </Badge>
                      <span className="text-sm text-gray-500">{attestation.date}</span>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
              <CardDescription>Common attestation types</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/attest/certification" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Shield className="h-4 w-4 mr-2" />
                  Certification
                </Button>
              </Link>
              <Link href="/attest/user-review" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <Star className="h-4 w-4 mr-2" />
                  User Review
                </Button>
              </Link>
              <Link href="/attest/endorsement" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <FileCheck className="h-4 w-4 mr-2" />
                  Endorsement
                </Button>
              </Link>
              <Link href="/attest/linked-identifier" className="block">
                <Button variant="outline" className="w-full justify-start">
                  <LinkIcon className="h-4 w-4 mr-2" />
                  Linked Identifier
                </Button>
              </Link>
            </CardContent>
          </Card>

          {/* Activity Summary */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Activity Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Week</span>
                  <span className="font-medium">3 attestations</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">This Month</span>
                  <span className="font-medium">8 attestations</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total</span>
                  <span className="font-medium">12 attestations</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
