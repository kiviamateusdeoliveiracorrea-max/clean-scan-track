
DROP POLICY IF EXISTS "auditorias insert" ON public.auditorias;
DROP POLICY IF EXISTS "auditorias update" ON public.auditorias;
DROP POLICY IF EXISTS "auditorias delete" ON public.auditorias;
CREATE POLICY "auditorias insert" ON public.auditorias FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "auditorias update" ON public.auditorias FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "auditorias delete" ON public.auditorias FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "nc insert" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc update" ON public.nao_conformidades;
DROP POLICY IF EXISTS "nc delete" ON public.nao_conformidades;
CREATE POLICY "nc insert" ON public.nao_conformidades FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "nc update" ON public.nao_conformidades FOR UPDATE TO authenticated
  USING (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'auditor') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "nc delete" ON public.nao_conformidades FOR DELETE TO authenticated
  USING (has_role(auth.uid(),'administrador') OR has_role(auth.uid(),'gestor'));
