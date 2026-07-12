import { AppExperience } from "../../app-experience";

export const metadata = {
  title: "学生画面デモ | Manalio",
  alternates: {
    canonical: "/demo/student",
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoStudentPage() {
  return (
    <>
      <div className="public-demo-route-note">
        架空の実習場面で試せます。実名・実習先名は入れないでください。
      </div>
      <AppExperience publicDemoRole="student" publicDemoReturnHref="/demo" />
    </>
  );
}
