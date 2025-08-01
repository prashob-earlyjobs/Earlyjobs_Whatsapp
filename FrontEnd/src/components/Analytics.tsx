
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, BarChart3 } from 'lucide-react';

export const Analytics = () => {
  const { user } = useAuth();

  // Check if user has admin access
  if (user?.role !== 'admin') {
    return (
      <div className="h-full p-6 overflow-y-auto">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-full">
            <div className="text-center space-y-4">
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto">
                <Shield className="w-8 h-8 text-red-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground mb-2">Access Denied</h2>
                <p className="text-muted-foreground mb-4">
                  You don't have permission to access the Analytics dashboard.
                </p>
                <Alert className="max-w-md mx-auto">
                  <AlertDescription>
                    Analytics access is restricted to administrators only. 
                    Please contact your system administrator if you need access to this feature.
                  </AlertDescription>
                </Alert>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
  // Mock data for analytics
  const deliveryData = [
    { name: 'Mon', sent: 120, delivered: 115, read: 98, replied: 32 },
    { name: 'Tue', sent: 98, delivered: 94, read: 82, replied: 28 },
    { name: 'Wed', sent: 156, delivered: 149, read: 128, replied: 45 },
    { name: 'Thu', sent: 134, delivered: 128, read: 108, replied: 38 },
    { name: 'Fri', sent: 142, delivered: 136, read: 115, replied: 41 },
    { name: 'Sat', sent: 89, delivered: 85, read: 72, replied: 22 },
    { name: 'Sun', sent: 67, delivered: 64, read: 54, replied: 18 }
  ];

  const templateUsage = [
    { name: 'Job Opportunity', value: 45, color: '#8884d8' },
    { name: 'Interview Confirmation', value: 32, color: '#82ca9d' },
    { name: 'Application Status', value: 18, color: '#ffc658' },
    { name: 'Offer Letter', value: 12, color: '#ff7300' },
    { name: 'Rejection Notice', value: 8, color: '#00c4a7' }
  ];

  const responseTimeData = [
    { hour: '9 AM', avgResponse: 12 },
    { hour: '10 AM', avgResponse: 8 },
    { hour: '11 AM', avgResponse: 15 },
    { hour: '12 PM', avgResponse: 22 },
    { hour: '1 PM', avgResponse: 18 },
    { hour: '2 PM', avgResponse: 9 },
    { hour: '3 PM', avgResponse: 11 },
    { hour: '4 PM', avgResponse: 14 },
    { hour: '5 PM', avgResponse: 19 }
  ];

  const stats = [
    { label: 'Total Messages Sent', value: '2,456', change: '+12%', positive: true },
    { label: 'Delivery Rate', value: '96.2%', change: '+2.1%', positive: true },
    { label: 'Read Rate', value: '82.4%', change: '-1.2%', positive: false },
    { label: 'Reply Rate', value: '28.7%', change: '+5.3%', positive: true },
    { label: 'Avg Response Time', value: '14 min', change: '-3 min', positive: true },
    { label: 'Active Conversations', value: '189', change: '+8%', positive: true }
  ];

  return (
    <div className="h-full p-6 overflow-y-auto">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground mb-2">Analytics Dashboard</h2>
          <p className="text-muted-foreground">Track your WhatsApp messaging performance</p>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
          {stats.map((stat, index) => (
            <Card key={index} className="p-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">{stat.label}</p>
                <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                <div className="flex items-center">
                  <Badge 
                    variant={stat.positive ? "default" : "destructive"}
                    className="text-xs"
                  >
                    {stat.change}
                  </Badge>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Message Delivery & Engagement</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={deliveryData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="sent" fill="#8884d8" name="Sent" />
                <Bar dataKey="delivered" fill="#82ca9d" name="Delivered" />
                <Bar dataKey="read" fill="#ffc658" name="Read" />
                <Bar dataKey="replied" fill="#ff7300" name="Replied" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Template Usage Distribution</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={templateUsage}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {templateUsage.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Average Response Time by Hour</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={responseTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="hour" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="avgResponse" 
                  stroke="#8884d8" 
                  strokeWidth={2}
                  name="Response Time (min)"
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6">
            <h3 className="text-lg font-semibold mb-4">Recent Activity</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">Bulk message campaign completed</p>
                  <p className="text-xs text-muted-foreground">156 messages sent successfully</p>
                </div>
                <Badge variant="default">Success</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">New template approved</p>
                  <p className="text-xs text-muted-foreground">"Interview Reminder" template</p>
                </div>
                <Badge variant="default">Approved</Badge>
              </div>
              <div className="flex items-center justify-between py-2 border-b border-border">
                <div>
                  <p className="text-sm font-medium">High response rate achieved</p>
                  <p className="text-xs text-muted-foreground">35% reply rate today</p>
                </div>
                <Badge variant="default">Achievement</Badge>
              </div>
              <div className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">Agent performance update</p>
                  <p className="text-xs text-muted-foreground">Sarah handled 45 conversations</p>
                </div>
                <Badge variant="outline">Info</Badge>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};
