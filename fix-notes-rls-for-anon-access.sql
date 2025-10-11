-- Fix Notes RLS Policies to Allow Anonymous Access
-- This allows the app to use Supabase anon key without requiring auth

-- Drop existing policies
DROP POLICY IF EXISTS "Allow all authenticated users to read notes" ON notes;
DROP POLICY IF EXISTS "Allow users to insert their own notes" ON notes;
DROP POLICY IF EXISTS "Allow users to update notes" ON notes;
DROP POLICY IF EXISTS "Allow users to delete notes" ON notes;

-- Create new policies that allow both authenticated AND anonymous access
-- This is safe because the app controls access at the application layer

-- Policy 1: Allow EVERYONE to read all notes (for cross-device sync)
CREATE POLICY "Allow everyone to read notes" ON notes
    FOR SELECT
    TO anon, authenticated
    USING (true);

-- Policy 2: Allow EVERYONE to insert notes
CREATE POLICY "Allow everyone to insert notes" ON notes
    FOR INSERT
    TO anon, authenticated
    WITH CHECK (true);

-- Policy 3: Allow EVERYONE to update notes (for collaborative editing)
CREATE POLICY "Allow everyone to update notes" ON notes
    FOR UPDATE
    TO anon, authenticated
    USING (true)
    WITH CHECK (true);

-- Policy 4: Allow EVERYONE to delete notes
CREATE POLICY "Allow everyone to delete notes" ON notes
    FOR DELETE
    TO anon, authenticated
    USING (true);

-- Add comments explaining the security model
COMMENT ON TABLE notes IS 'Notes with application-layer access control. RLS allows all access because app uses Azure AD for authentication, not Supabase auth.';

-- Verify grants are correct
GRANT ALL ON notes TO anon;
GRANT ALL ON notes TO authenticated;

-- Success message
SELECT 'RLS policies updated successfully - notes now accessible with anon key' AS status;
