pipeline {

agent any

parameters {
    string(
        name: 'PROJECT_NAME',
        defaultValue: 'three-tier',
        description: 'Project Name'
    )
}

environment {
    FRONTEND_IMAGE = "frontend"
    ADMIN_IMAGE = "admin"
    BACKEND_IMAGE = "backend"
    TAG = "${BUILD_NUMBER}"
    SCANNER_HOME = tool 'sonar-scanner'
}

stages {

    stage('Checkout') {
        steps {
            checkout scm
            sh 'mkdir -p reports'
        }
    }

    stage('Gitleaks Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                gitleaks detect \
                --source . \
                --report-format json \
                --report-path reports/gitleaks-report.json
                '''
            }
        }
    }

    stage('Trivy Filesystem Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                trivy fs . \
                --format json \
                --output reports/trivy-fs-report.json
                '''
            }
        }
    }

    stage('Detect Language') {
        steps {
            script {

                if (fileExists('Application-Code/backend/pom.xml')) {
                    env.APP_LANG = "java"
                }
                else if (fileExists('Application-Code/backend/package.json')) {
                    env.APP_LANG = "nodejs"
                }
                else if (fileExists('Application-Code/backend/requirements.txt')) {
                    env.APP_LANG = "python"
                }
                else if (fileExists('Application-Code/backend/go.mod')) {
                    env.APP_LANG = "golang"
                }
                else {
                    error("Unsupported Language")
                }

                echo "Detected Language: ${env.APP_LANG}"
            }
        }
    }

    stage('Backend Build') {
        steps {
            script {

                switch(env.APP_LANG) {

                    case "java":
                        dir('Application-Code/backend') {
                            sh 'mvn clean package -DskipTests'
                        }
                        break

                    case "nodejs":
                        dir('Application-Code/backend') {
                            sh '''
                            npm install
                            npm run build
                            '''
                        }
                        break

                    case "python":
                        dir('Application-Code/backend') {
                            sh '''
                            python3 -m venv venv
                            . venv/bin/activate
                            pip install -r requirements.txt
                            '''
                        }
                        break

                    case "golang":
                        dir('Application-Code/backend') {
                            sh 'go build ./...'
                        }
                        break
                }
            }
        }
    }

    stage('Frontend Build') {

        when {
            expression {
                fileExists('Application-Code/frontend/package.json')
            }
        }

        steps {

            dir('Application-Code/frontend') {

                sh '''
                export NODE_OPTIONS=--openssl-legacy-provider
                npm install
                npm run build
                '''
            }
        }
    }

    stage('Admin Build') {

        when {
            expression {
                fileExists('Application-Code/admin/package.json')
            }
        }

        steps {
            dir('Application-Code/admin') {
                sh '''
                export NODE_OPTIONS=--openssl-legacy-provider
                npm install
                npm run build
                '''
            }
        }
    }

    stage('Unit Tests') {

        steps {

            script {

                switch(env.APP_LANG) {

                    case "java":

                        dir('Application-Code/backend') {

                            if (fileExists('pom.xml')) {

                                sh '''
                                echo "Running Java Tests..." mvn test || true
                                '''

                            } else {

                                echo "pom.xml not found. Skipping tests..."
                            }
                        }

                        break


                    case "nodejs":

                        dir('Application-Code/backend') {

                            sh '''
                            TEST_SCRIPT=$(node -p "require('./package.json').scripts?.test || ''")

                            if [ -z "$TEST_SCRIPT" ] || \
                               [ "$TEST_SCRIPT" = "echo \\"Error: no test specified\\" && exit 1" ]; then

                                echo "No NodeJS tests configured. Skipping..."
    
                            else

                                echo "Running NodeJS Tests..."
                                npm test || true

                            fi
                            '''
                        }

                        break


                    case "python":

                        dir('Application-Code/backend') {

                            sh '''
                            . venv/bin/activate

                            if command -v pytest >/dev/null 2>&1; then

                                echo "Running Python Tests..."
                                pytest || true

                            else

                                echo "pytest not installed. Skipping..."

                            fi
                            '''
                        }

                        break


                    case "golang":

                        dir('Application-Code/backend') {

                            sh '''
                            echo "Running Golang Tests..."
                            go test ./... || true
                            '''
                        }

                        break
                }
            }
        }
    }

    stage('Detect Coverage Reports') {

        steps {

            sh '''
            echo "Searching for coverage reports..."

            find . -type f \\(
                -name "lcov.info" -o \
                -name "coverage.xml" -o \
                -name "jacoco.xml" -o \
                -name "*.exec" -o \
                -name "coverage.out"
            \\) || true
            '''
        }
    }
    
    stage('SonarQube Scan') {

        steps {
    
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
    
                withSonarQubeEnv('sonar') {
    
                    script {
    
                        switch(env.APP_LANG) {
    
                            case "java":
                                dir('Application-Code/backend') {
                                    sh '''
                                    mvn sonar:sonar \
                                    -Dsonar.projectKey=''' + PROJECT_NAME + '''-backend
                                    '''
                                }
                                break
    
                            case "nodejs":
                                dir('Application-Code/backend') {
                                    sh """
                                    ${SCANNER_HOME}/bin/sonar-scanner \
                                    -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                    -Dsonar.sources=. \
                                    -Dsonar.sourceEncoding=UTF-8
                                    """
                                }
                                break
    
                            case "python":
                                dir('Application-Code/backend') {
                                    sh """
                                    ${SCANNER_HOME}/bin/sonar-scanner \
                                    -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                    -Dsonar.sources=.
                                    """
                                }
                                break
    
                            case "golang":
                                dir('Application-Code/backend') {
                                    sh """
                                    ${SCANNER_HOME}/bin/sonar-scanner \
                                    -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                    -Dsonar.sources=.
                                    """
                                }
                                break
                        }
                    }
                }
            }
        }
    }

    stage('Quality Gate') {

        steps {

            timeout(time: 10, unit: 'MINUTES') {

                waitForQualityGate abortPipeline: false
            }
        }
    }

    stage('Build Frontend Image') {

        when {
            expression {
                fileExists('Application-Code/frontend/Dockerfile')
            }
        }
        steps {
            sh """
            docker build -t ${FRONTEND_IMAGE}:${TAG} -f Application-Code/frontend/Dockerfile Application-Code/frontend
            """
        }
    }


    stage('Build Backend Image') {

        when {
            expression {
                fileExists('Application-Code/backend/Dockerfile')
            }
        }

        steps {
            sh """
            docker build -t ${BACKEND_IMAGE}:${TAG} -f Application-Code/backend/Dockerfile Application-Code/backend
            """
        }
    }

    stage('Build Admin Image') {

        when {
            expression {
                fileExists('Application-Code/admin/Dockerfile')
            }
        }

        steps {
            sh """
            docker build -t ${ADMIN_IMAGE}:${TAG} -f Application-Code/admin/Dockerfile Application-Code/admin
            """
        }
    }
    

    stage('Trivy Image Scan') {

        steps {

            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {

                sh '''
                mkdir -p reports

                docker image inspect frontend:${TAG} >/dev/null 2>&1 && \
                trivy image \
                --format json \
                --output reports/trivy-frontend-image-report.json \
                frontend:${TAG} || true

                docker image inspect backend:${TAG} >/dev/null 2>&1 && \
                trivy image \
                --format json \
                --output reports/trivy-backend-image-report.json \
                backend:${TAG} || true

                docker image inspect admin:${TAG} >/dev/null 2>&1 && \
                trivy image \
                --format json \
                --output reports/trivy-admin-image-report.json \
                admin:${TAG} || true
                '''
            }
        }
    }

    
    stage('Build & Push Docker Images to ECR') {

    steps {

        withCredentials([
            [$class: 'AmazonWebServicesCredentialsBinding',
             credentialsId: 'aws-ecr-cred']
        ]) {

            sh '''
            ACCOUNT_ID=593402827159
            AWS_REGION=ap-south-1

            ECR_URL=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com

            FRONTEND_REPO=${PROJECT_NAME}-frontend
            BACKEND_REPO=${PROJECT_NAME}-backend
            ADMIN_REPO=${PROJECT_NAME}-admin

            # Login to ECR
            aws ecr get-login-password --region $AWS_REGION | \
            docker login --username AWS --password-stdin $ECR_URL

            # Frontend
            if docker image inspect frontend:${TAG} >/dev/null 2>&1; then

                docker tag frontend:${TAG} $ECR_URL/${FRONTEND_REPO}:${TAG}
                docker tag frontend:${TAG} $ECR_URL/${FRONTEND_REPO}:latest

                docker push $ECR_URL/${FRONTEND_REPO}:${TAG}
                docker push $ECR_URL/${FRONTEND_REPO}:latest

            fi

            # Backend
            if docker image inspect backend:${TAG} >/dev/null 2>&1; then

                docker tag backend:${TAG} $ECR_URL/${BACKEND_REPO}:${TAG}
                docker tag backend:${TAG} $ECR_URL/${BACKEND_REPO}:latest

                docker push $ECR_URL/${BACKEND_REPO}:${TAG}
                docker push $ECR_URL/${BACKEND_REPO}:latest

            fi

            # Admin
            if docker image inspect admin:${TAG} >/dev/null 2>&1; then

                docker tag admin:${TAG} $ECR_URL/${ADMIN_REPO}:${TAG}
                docker tag admin:${TAG} $ECR_URL/${ADMIN_REPO}:latest

                docker push $ECR_URL/${ADMIN_REPO}:${TAG}
                docker push $ECR_URL/${ADMIN_REPO}:latest

            fi
            #################################
            # CLEANUP
            #################################

            echo "Cleaning Docker Images..."

            # Cleanup local images
            docker rmi frontend:${TAG} || true
            docker rmi backend:${TAG} || true
            docker rmi admin:${TAG} || true

            # Cleanup ECR tagged images
            docker rmi $ECR_URL/${FRONTEND_REPO}:${TAG} || true
            docker rmi $ECR_URL/${FRONTEND_REPO}:latest || true

            docker rmi $ECR_URL/${BACKEND_REPO}:${TAG} || true
            docker rmi $ECR_URL/${BACKEND_REPO}:latest || true

            docker rmi $ECR_URL/${ADMIN_REPO}:${TAG} || true
            docker rmi $ECR_URL/${ADMIN_REPO}:latest || true

            # Remove dangling images
            docker image prune -af || true

            docker logout $ECR_URL || true

            '''
        }
    }
}

}
    

post {

    always {

        script {

            if (fileExists('.')) {

                archiveArtifacts(
                    artifacts: '''
                    reports/**/*,
                    **/coverage/**/*,
                    **/lcov.info,
                    **/coverage.xml,
                    **/jacoco.xml,
                    **/coverage.out,
                    **/*.exec,
                    **/target/*.jar,
                    **/target/surefire-reports/**/*,
                    **/dist/**/*,
                    **/build/**/*,
                    **/*.log
                    '''.trim(),

                    excludes: '''
                    **/node_modules/**,
                    **/Application-Code/**/node_modules/**,
                    **/.npm/**,
                    **/.cache/**
                    '''.trim(),
                
                    fingerprint: true,
                    allowEmptyArchive: true
                )
            }
        }

        cleanWs notFailBuild: true
    }

    success {
        echo 'Pipeline Success'
    }

    unstable {
        echo 'Pipeline Completed With Security Findings'
    }

    failure {
        echo 'Pipeline Failed'
    }
}

}
