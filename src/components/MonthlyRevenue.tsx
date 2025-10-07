import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { TrendingUp, DollarSign } from "lucide-react";

interface MonthlyData {
  month: string;
  revenue: number;
  bookings: number;
}

export const MonthlyRevenue = () => {
  const [year, setYear] = useState(new Date().getFullYear().toString());
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalRevenue, setTotalRevenue] = useState(0);

  const years = Array.from({ length: 5 }, (_, i) => (new Date().getFullYear() - i).toString());
  const monthNames = [
    "Jan", "Fév", "Mar", "Avr", "Mai", "Juin",
    "Juil", "Août", "Sep", "Oct", "Nov", "Déc"
  ];

  useEffect(() => {
    loadMonthlyData();
  }, [year]);

  const loadMonthlyData = async () => {
    setLoading(true);
    try {
      const { data: bookings, error } = await supabase
        .from('bookings')
        .select('appointment_date, total_price, status')
        .gte('appointment_date', `${year}-01-01`)
        .lte('appointment_date', `${year}-12-31`);

      if (error) throw error;

      // Grouper par mois
      const monthlyStats: Record<number, { revenue: number; bookings: number }> = {};
      
      for (let i = 0; i < 12; i++) {
        monthlyStats[i] = { revenue: 0, bookings: 0 };
      }

      let yearTotal = 0;

      bookings?.forEach((booking) => {
        const date = new Date(booking.appointment_date);
        const month = date.getMonth();
        const price = Number(booking.total_price);
        
        monthlyStats[month].revenue += price;
        monthlyStats[month].bookings += 1;
        
        if (booking.status === 'confirmed' || booking.status === 'completed') {
          yearTotal += price;
        }
      });

      const chartData = monthNames.map((name, index) => ({
        month: name,
        revenue: monthlyStats[index].revenue,
        bookings: monthlyStats[index].bookings,
      }));

      setMonthlyData(chartData);
      setTotalRevenue(yearTotal);
    } catch (error) {
      console.error('Erreur chargement données mensuelles:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center text-muted-foreground">Chargement...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-2xl font-bold">Chiffre d'affaires mensuel</CardTitle>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-32">
              <SelectValue placeholder="Année" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={y}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 mb-6">
            <div className="rounded-lg border p-4 bg-primary/5">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">CA Total {year}</span>
              </div>
              <div className="text-3xl font-bold text-primary">{totalRevenue.toFixed(2)}€</div>
            </div>
            <div className="rounded-lg border p-4 bg-green-500/5">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">Mois le plus rentable</span>
              </div>
              <div className="text-2xl font-bold text-green-600">
                {monthlyData.reduce((max, curr) => curr.revenue > max.revenue ? curr : max, monthlyData[0])?.month || '-'} 
                <span className="text-base ml-2">
                  ({Math.max(...monthlyData.map(d => d.revenue)).toFixed(0)}€)
                </span>
              </div>
            </div>
          </div>

          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="month" 
                  className="text-xs"
                />
                <YAxis 
                  className="text-xs"
                  tickFormatter={(value) => `${value}€`}
                />
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    if (name === 'revenue') return [`${value.toFixed(2)}€`, 'CA'];
                    return [value, 'Réservations'];
                  }}
                  contentStyle={{
                    backgroundColor: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Détail par mois</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
            {monthlyData.map((month, index) => (
              <div 
                key={index}
                className="rounded-lg border p-3 hover:bg-accent transition-colors"
              >
                <div className="font-medium mb-1">{month.month}</div>
                <div className="text-sm text-muted-foreground">
                  {month.bookings} réservation{month.bookings > 1 ? 's' : ''}
                </div>
                <div className="text-lg font-bold text-primary mt-1">
                  {month.revenue.toFixed(2)}€
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};