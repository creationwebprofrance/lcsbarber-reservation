-- Drop existing problematic policies
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can manage services" ON public.services;
DROP POLICY IF EXISTS "Admins can manage calendar settings" ON public.calendar_settings;
DROP POLICY IF EXISTS "Admins can manage date overrides" ON public.date_overrides;
DROP POLICY IF EXISTS "Admins can view all bookings" ON public.bookings;
DROP POLICY IF EXISTS "Admins can update bookings" ON public.bookings;

-- Create a security definer function to check admin role without recursion
CREATE OR REPLACE FUNCTION public.is_admin(user_uuid UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE user_id = user_uuid AND role = 'admin'
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create new non-recursive policies

-- Profiles policies (updated)
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (public.is_admin());

-- Services policies (updated)  
CREATE POLICY "Admins can manage services" ON public.services
  FOR ALL USING (public.is_admin());

-- Calendar settings policies (updated)
CREATE POLICY "Admins can manage calendar settings" ON public.calendar_settings
  FOR ALL USING (public.is_admin());

-- Date overrides policies (updated)
CREATE POLICY "Admins can manage date overrides" ON public.date_overrides
  FOR ALL USING (public.is_admin());

-- Bookings policies (updated)
CREATE POLICY "Admins can view all bookings" ON public.bookings
  FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins can update bookings" ON public.bookings
  FOR UPDATE USING (public.is_admin());

-- Create a test admin account (you'll need to sign up first, then this will upgrade it to admin)
-- First, let's create a function to make a user admin by email
CREATE OR REPLACE FUNCTION public.make_user_admin(user_email TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.profiles 
  SET role = 'admin' 
  WHERE email = user_email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;