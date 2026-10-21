/** Master reference display helper. A family can contain multiple EANs.
 * Do NOT pool stock, replace EANs, or assume variants are identical.
 */
export type MasterChild = {
  id: string;
  organizationId: string;
  familyId: string | null;
  sku: string;
  ean: string | null;
  masterReference: string | null;
};
export function resolveFamilyReference(child: MasterChild, siblings: MasterChild[]): string | null {
  if (!child.familyId) return child.masterReference?.trim() || null;
  const members = siblings.filter(
    (x) => x.organizationId === child.organizationId && x.familyId === child.familyId,
  );
  if (!members.some((x) => x.id === child.id))
    throw new Error("Product absent from authorized family");
  const refs = [
    ...new Set(members.map((x) => x.masterReference?.trim()).filter((x): x is string => !!x)),
  ];
  if (refs.length > 1) throw new Error("Conflicting master reference in product family");
  return refs[0] ?? null;
}
export function masterReferenceForPrint(product: {
  master_reference?: string | null;
  sku?: string | null;
}): string {
  return product.master_reference?.trim() || product.sku?.trim() || "—";
}
