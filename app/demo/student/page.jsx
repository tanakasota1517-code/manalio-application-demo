import { AppExperience } from "../../app-experience";

export const metadata = {
  title: "学生画面デモ | Manalio",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DemoStudentPage() {
  return (
    <>
      <div className="public-demo-route-note">
        公開デモです。架空データだけで試し、外部AI APIや学校データ保存は使いません。
      </div>
      <AppExperience publicDemoRole="student" publicDemoReturnHref="/demo" />
    </>
  );
}
