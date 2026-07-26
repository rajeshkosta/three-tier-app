pipeline {
    agent any

    parameters {
        string(
            name: 'PROJECT_NAME',
            defaultValue: 'wanderlust',
            description: 'Project Name'
        )
    }

    environment {
        PROJECT_NAME = "${params.PROJECT_NAME}"
        FRONTEND_IMAGE = "frontend"
        BACKEND_IMAGE  = "backend"
        ADMIN_IMAGE    = "admin"
        TAG = "${BUILD_NUMBER}"
        SCANNER_HOME = tool 'sonar-scanner'

    }

    stages {


//  CHECKOUT
    stage('Checkout') {
        steps {
            checkout scm
            sh ''' mkdir -p reports '''
        }
    }

// DETECT PROJECT STRUCTURE
    stage('Detect Project Structure') {
        steps {
            script {
                echo "========================================"
                echo " Detecting Project Structure"
                echo "========================================"

                env.HAS_FRONTEND = fileExists("Application-Code/frontend") ? "true" : "false"
                env.HAS_BACKEND  = fileExists("Application-Code/backend")  ? "true" : "false"
                env.HAS_ADMIN    = fileExists("Application-Code/admin")    ? "true" : "false"

                echo "Frontend : ${env.HAS_FRONTEND}"
                echo "Backend  : ${env.HAS_BACKEND}"
                echo "Admin    : ${env.HAS_ADMIN}"

                if (env.HAS_FRONTEND == "false" &&
                    env.HAS_BACKEND == "false" &&
                    env.HAS_ADMIN == "false") {
                    
                    error("No Application-Code structure found.")
                }
            }
        }
    }


    //DETECT BACKEND LANGUAGE
    stage('Detect Backend Language') {
        when {
            expression {
                env.HAS_BACKEND == "true"
            }
        }
        steps {
            script {
                echo "========================================"
                echo " Detecting Backend Language"
                echo "========================================"
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
                    error("Unsupported Backend Language")
                }
                echo "Detected Language : ${env.APP_LANG}"
            }
        }
    }

    //INSTALL DEPENDENCIES
    stage('Install Dependencies') {
        steps {
            script {
                /**********************
                 * BACKEND
                 **********************/
                if (env.HAS_BACKEND == "true") {
                    dir('Application-Code/backend') {
                        switch(env.APP_LANG) {
                            case "java":
                                sh '''
                                echo "Installing Maven Dependencies..."
                                mvn clean install -DskipTests
                                '''
                                break
                            case "nodejs":
                                sh '''
                                echo "Installing NodeJS Dependencies..."
                                npm install
                                '''
                                break
                            case "python":
                                sh '''
                                echo "Installing Python Dependencies..."
                                python3 -m venv venv
                                . venv/bin/activate
                                pip install --upgrade pip
                                pip install -r requirements.txt
                                '''
                                break
                            case "golang":
                                sh '''
                                echo "Downloading Go Modules..."
                                go mod download
                                '''
                                break
                        }
                    }
                }
                /**********************
                 * FRONTEND
                 **********************/
                if (env.HAS_FRONTEND == "true") {
                    dir('Application-Code/frontend') {
                        sh '''
                        echo "Installing Frontend Dependencies..."
                        export NODE_OPTIONS=--openssl-legacy-provider
                        npm install
                        '''
                    }
                }
                /**********************
                 * ADMIN
                 **********************/
                if (env.HAS_ADMIN == "true") {
                    dir('Application-Code/admin') {
                        sh '''
                        echo "Installing Admin Dependencies..."
                        export NODE_OPTIONS=--openssl-legacy-provider
                        npm install
                        '''
                    }
                }
            }
        }
    }

        
// LINT

    stage('Lint') {
        steps {
            script {
                /**********************
                 * Backend Lint
                 **********************/
                if (env.HAS_BACKEND == "true") {
                    dir('Application-Code/backend') {
                        switch(env.APP_LANG) {
                            case "java":
                                sh '''
                                echo "Running Java Lint..."
                                if [ -f pom.xml ]; then
                                    mvn checkstyle:check || true
                                fi
                                '''
                                break
                            case "nodejs":
                                sh '''
                                echo "Running ESLint..."
                                if [ -f package.json ]; then
                                    if node -e "process.exit(require('./package.json').scripts?.lint ? 0 : 1)"; then
                                        npm run lint || true
                                    else
                                        echo "No lint script found."
                                    fi
                                fi
                                '''
                                break
                            case "python":
                                sh '''
                                echo "Running Pylint..."
                                . venv/bin/activate
                                pip install pylint >/dev/null 2>&1 || true
                                find . -name "*.py" | xargs pylint || true
                                '''
                                break
                            case "golang":
                                sh '''
                                echo "Running Go Lint..."
                                golangci-lint run || true
                                '''
                                break
                        }
                    }
                }
            }
        }
    }

// DEPENDENCY SCAN
    stage('Dependency Scan') {
        steps {
            script {
                if (env.HAS_BACKEND == "true") {
                    dir('Application-Code/backend') {
                        switch(env.APP_LANG) {
                            case "java":
                                sh '''
                                echo "Running OWASP Dependency Check..."
                                dependency-check.sh --scan .  --format HTML  --format JSON  --out ../../reports/dependency-check || true
                                '''
                                break
                            case "nodejs":
                                sh '''
                                echo "Running npm audit..."
                                npm audit --audit-level=high || true
                                '''
                                break
                            case "python":
                                sh '''
                                echo "Running pip-audit..."
                                . venv/bin/activate
                                pip install pip-audit >/dev/null 2>&1 || true
                                pip-audit || true
                                '''
                                break
                            case "golang":
                                sh '''
                                echo "Running govulncheck..."
                                govulncheck ./... || true
                                '''
                                break
                        }
                    }
                }
            }
        }
    }
 
//  UNIT TESTS

    stage('Unit Tests') {
        steps {
            script {
                if (env.HAS_BACKEND == "true") {
                    dir('Application-Code/backend') {
                        switch(env.APP_LANG) {
                            case "java":
                                sh '''
                                echo "Running Java Tests..."
                                mvn test || true
                                '''
                                break
                            case "nodejs":
                                sh '''
                                echo "Running NodeJS Tests..."
                                TEST_SCRIPT=$(node -p "require('./package.json').scripts?.test || ''")
                                if [ -z "$TEST_SCRIPT" ] || \
                                   [ "$TEST_SCRIPT" = "echo \\"Error: no test specified\\" && exit 1" ]; then
                                    echo "No Unit Tests Configured."
                                else
                                    npm test || true
                                fi
                                '''
                                break
                            case "python":
                                sh '''
                                echo "Running Python Tests..."
                                . venv/bin/activate
                                if command -v pytest >/dev/null 2>&1
                                then
                                    pytest || true
                                else
                                    echo "pytest not installed."
                                fi
                                '''
                                break
                            case "golang":
                                sh '''
                                echo "Running Go Tests..."
                                go test ./... || true
                                '''
                                break
                        }
                    }
                }
            }
        }
    }
 
//  COVERAGE REPORT DETECTION
    stage('Coverage') {
        steps {
            sh '''
            echo "======================================"
            echo "Searching Coverage Reports"
            echo "======================================"
            find . -type f \
            \\( \
                -name "lcov.info" -o \
                -name "coverage.xml" -o \
                -name "jacoco.xml" -o \
                -name "*.exec" -o \
                -name "coverage.out" \
            \\) || true
            '''
        }
    }

// SONARQUBE ANALYSIS

    stage('SonarQube Analysis') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                withSonarQubeEnv('sonarqube') {
                    script {
                        if (env.HAS_BACKEND == "true") {
                            dir('Application-Code/backend') {
                                switch(env.APP_LANG) {
                                    /**************** JAVA ****************/
                                    case "java":
                                        sh """
                                        mvn sonar:sonar \
                                        -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                        -Dsonar.projectName=${PROJECT_NAME}-backend
                                        """
                                        break
                                    /**************** NODEJS ****************/
                                    case "nodejs":
                                        sh """
                                        ${SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                        -Dsonar.projectName=${PROJECT_NAME}-backend \
                                        -Dsonar.sources=. \
                                        -Dsonar.sourceEncoding=UTF-8 \
                                        -Dsonar.javascript.lcov.reportPaths=coverage/lcov.info
                                        """
                                        break
                                    /**************** PYTHON ****************/
                                    case "python":
                                        sh """
                                        ${SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                        -Dsonar.projectName=${PROJECT_NAME}-backend \
                                        -Dsonar.sources=. \
                                        -Dsonar.python.coverage.reportPaths=coverage.xml
                                        """
                                        break
                                    /**************** GOLANG ****************/
                                    case "golang":
                                        sh """
                                        ${SCANNER_HOME}/bin/sonar-scanner \
                                        -Dsonar.projectKey=${PROJECT_NAME}-backend \
                                        -Dsonar.projectName=${PROJECT_NAME}-backend \
                                        -Dsonar.sources=. \
                                        -Dsonar.go.coverage.reportPaths=coverage.out
                                        """
                                        break
                                }
                            }
                        }
                    }
                }
            }
        }
    }

// SONAR QUALITY GATE

    stage('Quality Gate') {
        steps {
            timeout(time: 10, unit: 'MINUTES') {
                waitForQualityGate abortPipeline: true
            }
        }
    }
 
// TRIVY FILESYSTEM SCAN

    stage('Trivy Filesystem Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                mkdir -p reports/trivy
                echo "===================================="
                echo "Trivy Filesystem Scan"
                echo "===================================="
                trivy fs . --scanners vuln,secret,misconfig  --format json --output reports/trivy/trivy-fs-report.json
                trivy fs . --scanners vuln,secret,misconfig --format template --template "@/usr/local/share/trivy/templates/html.tpl" --output reports/trivy/trivy-fs-report.html
                '''
            }
        }
    }
 
 //  APPLICATION BUILD
 
    stage('Build') {
        steps {
            script {
                /**********************
                 * BACKEND BUILD
                 **********************/
                if (env.HAS_BACKEND == "true") {
                   dir('Application-Code/backend') {    
                        switch(env.APP_LANG) {
                            case "java":
                                sh '''
                                echo "Building Java Application..."
                                mvn clean package -DskipTests
                                mkdir -p ../../artifacts/backend
                                cp target/*.jar ../../artifacts/backend/ 2>/dev/null || true
                                cp target/*.war ../../artifacts/backend/ 2>/dev/null || true
                                '''
                                break
                            case "nodejs":
                                sh '''
                                echo "Building NodeJS Application..."
                                if node -e "process.exit(require('./package.json').scripts?.build ? 0 : 1)"
                                then
                                    npm run build
                                else
                                    echo "No build script found. Skipping build."
                                fi
                                mkdir -p ../../artifacts/backend
                                tar --exclude=node_modules --exclude=.git -czf ../../artifacts/backend/backend-${BUILD_NUMBER}.tar.gz .
                                '''
                                break
                            case "python":
                                sh '''
                                echo "Packaging Python Application..."
                                mkdir -p ../../artifacts/backend
                                tar --exclude=venv --exclude=__pycache__ --exclude=.git -czf ../../artifacts/backend/backend-${BUILD_NUMBER}.tar.gz .
                                '''
                                break
                            case "golang":
                                sh '''
                                echo "Building Go Application..."
                                go build -o app .
                                mkdir -p ../../artifacts/backend
                                cp app ../../artifacts/backend/
                                '''
                                break
                        }
                    }
                }

        
    // FRONTEND BUILD
    
            if (env.HAS_FRONTEND == "true") {
                dir('Application-Code/frontend') {
                    sh '''
                    export NODE_OPTIONS=--openssl-legacy-provider
                    npm run build
                    mkdir -p ../../artifacts/frontend
                    if [ -d dist ]; then
                        cp -r dist ../../artifacts/frontend/
                    fi
                    if [ -d build ]; then
                        cp -r build ../../artifacts/frontend/
                    fi
                    '''
                }
            }
            /**********************
             * ADMIN BUILD
             **********************/
            if (env.HAS_ADMIN == "true") {
                dir('Application-Code/admin') {
                    sh '''
                    export NODE_OPTIONS=--openssl-legacy-provider
                    npm run build
                    mkdir -p ../../artifacts/admin
                    if [ -d dist ]; then
                        cp -r dist ../../artifacts/admin/
                    fi
                    if [ -d build ]; then
                        cp -r build ../../artifacts/admin/
                    fi
                    '''
                }
            }
            sh '''
            echo "=============================="
            echo "Generated Artifacts"
            echo "=============================="
            find artifacts -type f || true
            '''
                /**********************
                 * FRONTEND BUILD
                 **********************/
                if (env.HAS_FRONTEND == "true") {
                    dir('Application-Code/frontend') {
                        sh '''
                        echo "Building Frontend..."
                        export NODE_OPTIONS=--openssl-legacy-provider
                        npm run build
                        '''
                    }
                }

                /**********************
                 * ADMIN BUILD
                 **********************/
                if (env.HAS_ADMIN == "true") {
                    dir('Application-Code/admin') {
                        sh '''
                        echo "Building Admin..."
                        export NODE_OPTIONS=--openssl-legacy-provider
                        npm run build
                        '''
                    }
                }
            }
        }
    }


// DOCKER BUILD

    stage('Docker Build') {
        steps {
            script {
                if (env.HAS_FRONTEND == "true" &&
                    fileExists('Application-Code/frontend/Dockerfile')) {
                    sh """
                    docker build -t ${FRONTEND_IMAGE}:${TAG} -f Application-Code/frontend/Dockerfile Application-Code/frontend
                    """
                }
                if (env.HAS_BACKEND == "true" &&
                    fileExists('Application-Code/backend/Dockerfile')) {
                    sh """
                    docker build -t ${BACKEND_IMAGE}:${TAG} -f Application-Code/backend/Dockerfile Application-Code/backend
                    """
                }
                if (env.HAS_ADMIN == "true" &&
                    fileExists('Application-Code/admin/Dockerfile')) {
                    sh """
                    docker build -t ${ADMIN_IMAGE}:${TAG} -f Application-Code/admin/Dockerfile Application-Code/admin
                    """
                }
            }
        }
    }


 // TRIVY IMAGE SCAN
    stage('Trivy Image Scan') {
        steps {
            catchError(buildResult: 'SUCCESS', stageResult: 'UNSTABLE') {
                sh '''
                mkdir -p reports/trivy
                mkdir -p reports/sbom
                scan_image() {
                    IMAGE=$1
                    NAME=$2
                    if docker image inspect ${IMAGE} >/dev/null 2>&1; then
                        echo "Scanning ${IMAGE}"
                      
                        # JSON Report
                        trivy image  --format json --output reports/trivy/${NAME}.json ${IMAGE}
                        # HTML Report
                        trivy image --format template --template "@/usr/local/share/trivy/templates/html.tpl" --output reports/trivy/${NAME}.html ${IMAGE}
                        # SBOM
                        trivy image  --format cyclonedx  --output reports/sbom/${NAME}-sbom.json  ${IMAGE}
                        # Fail Build
                        trivy image --severity HIGH,CRITICAL --exit-code 1 ${IMAGE}
                    else
                        echo "${IMAGE} not found"
                    fi
                }
                scan_image frontend:${TAG} frontend
                scan_image backend:${TAG} backend
                scan_image admin:${TAG} admin
                '''
            }
        }
    }

//  Build & Push Docker Images to DockerHub
            
    stage('Build & Push Docker Images to DockerHub') {
        steps {
            withCredentials([
                usernamePassword(
                    credentialsId: 'dockerhub-cred',
                    usernameVariable: 'DOCKER_USER',
                    passwordVariable: 'DOCKER_PASS'
                )
            ]) {
                sh '''
                echo "Logging into Docker Hub..."
                echo $DOCKER_PASS | docker login -u $DOCKER_USER --password-stdin

                FRONTEND_REPO=$DOCKER_USER/${PROJECT_NAME}-frontend
                BACKEND_REPO=$DOCKER_USER/${PROJECT_NAME}-backend
                ADMIN_REPO=$DOCKER_USER/${PROJECT_NAME}-admin
    
                echo "Docker Hub repositories are ready."
    
                # FRONTEND
                if docker image inspect frontend:${TAG} >/dev/null 2>&1; then
                
                    docker tag frontend:${TAG} $FRONTEND_REPO:${TAG}
                    docker push $FRONTEND_REPO:${TAG}
                fi
             
                # BACKEND
                if docker image inspect backend:${TAG} >/dev/null 2>&1; then
                
                    docker tag backend:${TAG} $BACKEND_REPO:${TAG}
                    docker push $BACKEND_REPO:${TAG}
                fi
              
                # ADMIN
                if docker image inspect admin:${TAG} >/dev/null 2>&1; then
    
                    docker tag admin:${TAG} $ADMIN_REPO:${TAG}
                    docker push $ADMIN_REPO:${TAG}
                fi
                
                # CLEANUP
                echo "Cleaning Docker Images..."

                # Remove local images
    
                docker rmi frontend:${TAG} || true
                docker rmi backend:${TAG} || true
                docker rmi admin:${TAG} || true
        
                # Remove DockerHub tagged images
    
                docker rmi $FRONTEND_REPO:${TAG} || true
                docker rmi $BACKEND_REPO:${TAG} || true
                docker rmi $ADMIN_REPO:${TAG} || true
              
                # Remove dangling images
                docker logout || true
                echo "Docker Hub Push Completed Successfully"
                '''
            }
        }
    }

    // stage('Push Docker Images to Nexus') {

    //     steps {
    
    //         withCredentials([
    //             usernamePassword(
    //                 credentialsId: 'nexus-docker-cred',
    //                 usernameVariable: 'NEXUS_USER',
    //                 passwordVariable: 'NEXUS_PASS'
    //             )
    //         ]) {
    
    //             sh '''
    
    //             NEXUS_URL=localhost:32770
    
    //             FRONTEND_REPO=$NEXUS_URL/${PROJECT_NAME}-frontend
    //             BACKEND_REPO=$NEXUS_URL/${PROJECT_NAME}-backend
    //             ADMIN_REPO=$NEXUS_URL/${PROJECT_NAME}-admin
    
    //             echo "$NEXUS_PASS" | docker login -u "$NEXUS_USER" --password-stdin $NEXUS_URL
    
    //             docker tag frontend:${TAG} $FRONTEND_REPO:${TAG}
    //             docker push $FRONTEND_REPO:${TAG}
    
    //             docker tag backend:${TAG} $BACKEND_REPO:${TAG}
    //             docker push $BACKEND_REPO:${TAG}
    
    //             docker tag admin:${TAG} $ADMIN_REPO:${TAG}
    //             docker push $ADMIN_REPO:${TAG}
    
    //             docker logout $NEXUS_URL
    
    //             '''
    //         }
    //     }
    // }

        
    // stage('Build & Push Docker Images to ECR') {

    //     steps {
    
    //         withCredentials([
    //             [$class: 'AmazonWebServicesCredentialsBinding',
    //              credentialsId: 'aws-ecr-cred']
    //         ]) {
    
    //             sh '''
    //             ACCOUNT_ID=593402827159
    //             AWS_REGION=ap-south-1
    
    //             ECR_URL=$ACCOUNT_ID.dkr.ecr.$AWS_REGION.amazonaws.com
    
    //             FRONTEND_REPO=${PROJECT_NAME}-frontend
    //             BACKEND_REPO=${PROJECT_NAME}-backend
    //             ADMIN_REPO=${PROJECT_NAME}-admin
    
    //             # Login to ECR
    //             aws ecr get-login-password --region $AWS_REGION | docker login --username AWS --password-stdin $ECR_URL
    //             echo "Checking ECR repositories..."
    
    //             # Frontend Repository
    //             aws ecr describe-repositories --repository-names $FRONTEND_REPO --region $AWS_REGION >/dev/null 2>&1 || aws ecr create-repository --repository-name $FRONTEND_REPO --region $AWS_REGION
                
    //             # Backend Repository
    //             aws ecr describe-repositories --repository-names $BACKEND_REPO --region $AWS_REGION >/dev/null 2>&1 || aws ecr create-repository --repository-name $BACKEND_REPO --region $AWS_REGION
        
    //             # Admin Repository
    //             aws ecr describe-repositories --repository-names $ADMIN_REPO --region $AWS_REGION >/dev/null 2>&1 || aws ecr create-repository --repository-name $ADMIN_REPO  --region $AWS_REGION
                
    //             echo "Repositories are ready."
    
    //             # Frontend
    //             if docker image inspect frontend:${TAG} >/dev/null 2>&1; then
    
    //                 docker tag frontend:${TAG} $ECR_URL/${FRONTEND_REPO}:${TAG}
    //                 docker push $ECR_URL/${FRONTEND_REPO}:${TAG}
    //             fi
    
    //             # Backend
    //             if docker image inspect backend:${TAG} >/dev/null 2>&1; then
    
    //                 docker tag backend:${TAG} $ECR_URL/${BACKEND_REPO}:${TAG}
    //                 docker push $ECR_URL/${BACKEND_REPO}:${TAG}
    //             fi
    
    //             # Admin
    //             if docker image inspect admin:${TAG} >/dev/null 2>&1; then
    
    //                 docker tag admin:${TAG} $ECR_URL/${ADMIN_REPO}:${TAG}
    //                 docker push $ECR_URL/${ADMIN_REPO}:${TAG}
    //             fi
    //             #################################
    //             # CLEANUP
    //             #################################
    //             echo "Cleaning Docker Images..."
    
    //             # Cleanup local images
    //             docker rmi frontend:${TAG} || true
    //             docker rmi backend:${TAG} || true
    //             docker rmi admin:${TAG} || true
    
    //             # Cleanup ECR tagged images
    //             docker rmi $ECR_URL/${FRONTEND_REPO}:${TAG} || true
    //             docker rmi $ECR_URL/${BACKEND_REPO}:${TAG} || true
    //             docker rmi $ECR_URL/${ADMIN_REPO}:${TAG} || true
            
    //             docker logout $ECR_URL || true
    
    //             '''
    //         }
    //     }
    // }
        
    // UPDATE DEV IMAGE TAG
    stage('Update GitOps Manifest') {
        steps {
            dir('gitops') {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-creds',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_PASSWORD'
                    )
                ]) {
                    sh """
                    git fetch origin
                    git checkout -B main origin/main
                    
                    yq -i '.frontend.image.tag = "${TAG}"' wanderlust/values-dev.yaml
                    yq -i '.backend.image.tag = "${TAG}"' wanderlust/values-dev.yaml
    
                    git config user.name "rajeshkosta"
                    git config user.email "rajesh.kosta8982@yahoo.com"
    
                    git add wanderlust/values-dev.yaml
                    git commit -m "Deploy build ${TAG} to Dev" || true
    
                    git remote set-url origin https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/rajeshkosta/wanderlust.git
                    git push origin main
                    """
                }
            }
        }
    }
    
    // APPROVE STAGE DEPLOYMENT
    stage('Approve Stage') {
        steps {
            input(
                message: "Deploy Build ${TAG} to Stage?",
                ok: "Deploy"
            )
        }
    }
    
    // UPDATE STAGE IMAGE TAG
    stage('Update Stage Image Tag') {
        steps {
            dir('gitops') {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-creds',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_PASSWORD'
                    )
                ]) {
                    sh """
                    yq -i '.frontend.image.tag = "${TAG}"' wanderlust/values-stage.yaml
                    yq -i '.backend.image.tag = "${TAG}"' wanderlust/values-stage.yaml
    
                    git add wanderlust/values-stage.yaml
                    git commit -m "Deploy build ${TAG} to Stage" || true
    
                    git remote set-url origin https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/rajeshkosta/wanderlust.git
                    git push origin main
                    """
                }
            }
        }
    }
    
    // APPROVE PRODUCTION DEPLOYMENT
    stage('Approve Production') {
        steps {
            input(
                message: "Deploy Build ${TAG} to Production?",
                ok: "Deploy"
            )
        }
    }
    
    // UPDATE PRODUCTION IMAGE TAG
    stage('Update Production Image Tag') {
        steps {
            dir('gitops') {
                withCredentials([
                    usernamePassword(
                        credentialsId: 'github-creds',
                        usernameVariable: 'GIT_USERNAME',
                        passwordVariable: 'GIT_PASSWORD'
                    )
                ]) {
                    sh """
                    yq -i '.frontend.image.tag = "${TAG}"' wanderlust/values-prod.yaml
                    yq -i '.backend.image.tag = "${TAG}"' wanderlust/values-prod.yaml
    
                    git add wanderlust/values-prod.yaml
                    git commit -m "Deploy build ${TAG} to Production" || true
    
                    git remote set-url origin https://${GIT_USERNAME}:${GIT_PASSWORD}@github.com/rajeshkosta/wanderlust.git
                    git push origin main
                    """
                }
            }
        }
    }
}

        
/***************************************************************
 * POST ACTIONS
 ***************************************************************/
post {

    always {

        archiveArtifacts(

            artifacts: '''
artifacts/**/*,
reports/**/*,
**/coverage/**/*,
**/lcov.info,
**/coverage.xml,
**/jacoco.xml,
**/*.exec,
**/coverage.out,
**/target/*.jar,
**/target/*.war,
**/dist/**/*,
**/build/**/*,
**/*.log
''',

            excludes: '''
**/node_modules/**,
**/.npm/**,
**/.cache/**
''',
            fingerprint: true,
            allowEmptyArchive: true
        )
        cleanWs notFailBuild: true
    }
    success {
        echo "Pipeline Completed Successfully"
    }
    unstable {
        echo "Pipeline Completed with Security Findings"
    }
    failure {
        echo "Pipeline Failed"
    }
} // End post
} // End pipeline
